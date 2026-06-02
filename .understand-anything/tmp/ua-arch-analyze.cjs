const fs = require('fs');
const path = require('path');

// Read input JSON
const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: node ua-arch-analyze.js <input.json> <output.json>');
  process.exit(1);
}

let input;
try {
  const inputContent = fs.readFileSync(inputFile, 'utf8');
  input = JSON.parse(inputContent);
} catch (err) {
  console.error(`Failed to read input file: ${err.message}`);
  process.exit(1);
}

const { fileNodes, importEdges, allEdges } = input;

// Initialize result object
const result = {
  scriptCompleted: true,
  directoryGroups: {},
  nodeTypeGroups: {},
  crossCategoryEdges: [],
  interGroupImports: [],
  intraGroupDensity: {},
  patternMatches: {},
  deploymentTopology: {
    hasDockerfile: false,
    hasCompose: false,
    hasK8s: false,
    hasTerraform: false,
    hasCI: false,
    infraFiles: []
  },
  dataPipeline: {
    schemaFiles: [],
    migrationFiles: [],
    dataModelFiles: [],
    apiHandlerFiles: []
  },
  docCoverage: {
    groupsWithDocs: 0,
    totalGroups: 0,
    coverageRatio: 0,
    undocumentedGroups: []
  },
  dependencyDirection: [],
  fileStats: {
    totalFileNodes: fileNodes.length,
    filesPerGroup: {},
    nodeTypeCounts: {}
  },
  fileFanIn: {},
  fileFanOut: {}
}

// ============================================================================
// A. Directory Grouping
// ============================================================================

// Find common path prefix
function findCommonPrefix(paths) {
  if (paths.length === 0) return '';
  if (paths.length === 1) return paths[0];

  const parts = paths.map(p => p.split('/'));
  let common = [];

  for (let i = 0; i < parts[0].length; i++) {
    const currentPart = parts[0][i];
    if (parts.every(p => p[i] === currentPart)) {
      common.push(currentPart);
    } else {
      break;
    }
  }

  return common.join('/') + (common.length > 0 ? '/' : '');
}

const filePaths = fileNodes.filter(n => n.type === 'file').map(n => n.filePath);
const commonPrefix = findCommonPrefix(filePaths);
const prefixLen = commonPrefix.length;

// Group by directory after common prefix
fileNodes.forEach(node => {
  const fp = node.filePath;
  let group;

  if (fp.startsWith(commonPrefix)) {
    const remaining = fp.slice(prefixLen);
    const firstSlash = remaining.indexOf('/');

    if (firstSlash === -1) {
      // File is directly in common prefix directory
      group = 'root';
    } else {
      group = remaining.slice(0, firstSlash);
    }
  } else {
    // No common prefix, use first segment
    const firstSlash = fp.indexOf('/');
    group = firstSlash === -1 ? 'root' : fp.slice(0, firstSlash);
  }

  if (!result.directoryGroups[group]) {
    result.directoryGroups[group] = [];
  }
  result.directoryGroups[group].push(node.id);
});

// ============================================================================
// B. Node Type Grouping
// ============================================================================

fileNodes.forEach(node => {
  if (!result.nodeTypeGroups[node.type]) {
    result.nodeTypeGroups[node.type] = [];
  }
  result.nodeTypeGroups[node.type].push(node.id);
});

// Count node types
Object.entries(result.nodeTypeGroups).forEach(([type, nodes]) => {
  result.fileStats.nodeTypeCounts[type] = nodes.length;
});

// Count files per group
Object.entries(result.directoryGroups).forEach(([group, nodes]) => {
  result.fileStats.filesPerGroup[group] = nodes.length;
});

// ============================================================================
// C. Import Adjacency Matrix
// ============================================================================

const importAdj = {};
const fanIn = {};
const fanOut = {};

// Initialize adjacency
fileNodes.forEach(node => {
  importAdj[node.id] = new Set();
  fanIn[node.id] = 0;
  fanOut[node.id] = 0;
});

// Build adjacency
importEdges.forEach(edge => {
  importAdj[edge.source].add(edge.target);
  fanOut[edge.source]++;
  fanIn[edge.target]++;
});

result.fileFanIn = Object.fromEntries(
  Object.entries(fanIn).filter(([k, v]) => v > 0).sort((a, b) => b[1] - a[1])
);
result.fileFanOut = Object.fromEntries(
  Object.entries(fanOut).filter(([k, v]) => v > 0).sort((a, b) => b[1] - a[1])
);

// ============================================================================
// D. Cross-Category Dependency Analysis
// ============================================================================

const crossCategoryMatrix = {};

allEdges.forEach(edge => {
  const sourceNode = fileNodes.find(n => n.id === edge.source);
  const targetNode = fileNodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) return;

  const key = `${sourceNode.type}->${targetNode.type}:${edge.type}`;
  if (!crossCategoryMatrix[key]) {
    crossCategoryMatrix[key] = { fromType: sourceNode.type, toType: targetNode.type, edgeType: edge.type, count: 0 };
  }
  crossCategoryMatrix[key].count++;
});

result.crossCategoryEdges = Object.values(crossCategoryMatrix);

// ============================================================================
// E. Inter-Group Import Frequency
// ============================================================================

const interGroupMatrix = {};

importEdges.forEach(edge => {
  const sourceNode = fileNodes.find(n => n.id === edge.source);
  const targetNode = fileNodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) return;
  if (sourceNode.type !== 'file' || targetNode.type !== 'file') return;

  const sourceGroup = getGroupForNode(sourceNode.id);
  const targetGroup = getGroupForNode(targetNode.id);

  if (!sourceGroup || !targetGroup) return;
  if (sourceGroup === targetGroup) return; // Skip intra-group

  const key = `${sourceGroup}->${targetGroup}`;
  if (!interGroupMatrix[key]) {
    interGroupMatrix[key] = { from: sourceGroup, to: targetGroup, count: 0 };
  }
  interGroupMatrix[key].count++;
});

result.interGroupImports = Object.values(interGroupMatrix).sort((a, b) => b.count - a.count);

// ============================================================================
// F. Intra-Group Import Density
// ============================================================================

Object.keys(result.directoryGroups).forEach(group => {
  const groupNodes = result.directoryGroups[group];
  const nodeSet = new Set(groupNodes);

  let internalEdges = 0;
  let totalEdges = 0;

  importEdges.forEach(edge => {
    const sourceInGroup = nodeSet.has(edge.source);
    const targetInGroup = nodeSet.has(edge.target);

    if (sourceInGroup || targetInGroup) {
      totalEdges++;
      if (sourceInGroup && targetInGroup) {
        internalEdges++;
      }
    }
  });

  const density = totalEdges > 0 ? internalEdges / totalEdges : 0;
  result.intraGroupDensity[group] = {
    internalEdges,
    totalEdges,
    density
  };
});

// ============================================================================
// G. Directory Pattern Matching
// ============================================================================

const directoryPatterns = {
  'routes': 'api',
  'api': 'api',
  'controllers': 'api',
  'endpoints': 'api',
  'handlers': 'api',
  'services': 'service',
  'core': 'service',
  'lib': 'service',
  'domain': 'service',
  'logic': 'service',
  'models': 'data',
  'db': 'data',
  'data': 'data',
  'persistence': 'data',
  'repository': 'data',
  'entities': 'data',
  'components': 'ui',
  'views': 'ui',
  'pages': 'ui',
  'ui': 'ui',
  'layouts': 'ui',
  'screens': 'ui',
  'middleware': 'middleware',
  'plugins': 'middleware',
  'interceptors': 'middleware',
  'guards': 'middleware',
  'utils': 'utility',
  'helpers': 'utility',
  'common': 'utility',
  'shared': 'utility',
  'tools': 'utility',
  'config': 'config',
  'constants': 'config',
  'env': 'config',
  'settings': 'config',
  '__tests__': 'test',
  'test': 'test',
  'tests': 'test',
  'spec': 'test',
  'specs': 'test',
  'types': 'types',
  'interfaces': 'types',
  'schemas': 'types',
  'contracts': 'types',
  'dtos': 'types',
  'hooks': 'hooks',
  'store': 'state',
  'state': 'state',
  'reducers': 'state',
  'actions': 'state',
  'slices': 'state',
  'assets': 'assets',
  'static': 'assets',
  'public': 'assets',
  'migrations': 'data',
  'management': 'config',
  'commands': 'config',
  'templatetags': 'utility',
  'signals': 'service',
  'serializers': 'api',
  'cmd': 'entry',
  'internal': 'service',
  'pkg': 'utility',
  'dto': 'types',
  'request': 'types',
  'response': 'types',
  'entity': 'data',
  'controller': 'api',
  'routers': 'api',
  'composables': 'service',
  'blueprints': 'api',
  'mailers': 'service',
  'jobs': 'service',
  'channels': 'service',
  'bin': 'entry',
  'docs': 'documentation',
  'documentation': 'documentation',
  'wiki': 'documentation',
  'deploy': 'infrastructure',
  'deployment': 'infrastructure',
  'infra': 'infrastructure',
  'infrastructure': 'infrastructure',
  '.github': 'ci-cd',
  '.gitlab': 'ci-cd',
  '.circleci': 'ci-cd',
  'k8s': 'infrastructure',
  'kubernetes': 'infrastructure',
  'helm': 'infrastructure',
  'charts': 'infrastructure',
  'terraform': 'infrastructure',
  'tf': 'infrastructure',
  'docker': 'infrastructure',
  'sql': 'data',
  'database': 'data',
  'schema': 'data',
  'example': 'example',
  'examples': 'example'
};

Object.keys(result.directoryGroups).forEach(dir => {
  result.patternMatches[dir] = directoryPatterns[dir] || 'service';
});

// File-level patterns
fileNodes.forEach(node => {
  const name = node.name;
  const fp = node.filePath;

  // Test files
  if (name.match(/\.test\./) || name.match(/\.spec\./) ||
      name.match(/^test_.*\.py$/) || name.match(/.*_test\.go$/) ||
      name.match(/.*Test\.java$/) || name.match(/.*_spec\.rb$/) ||
      name.match(/.*Test\.php$/) || name.match(/.*Tests\.cs$/)) {
    // File is in test directory, leave it
  }

  // Entry files
  if ((name === 'index.ts' || name === 'index.js' || name === '__init__.py') &&
      fp.split('/').length <= 2) {
    // Index file at package root
  }

  if (name === 'manage.py' && fp.split('/').length === 1) {
    // Django entry point
  }

  if (name === 'wsgi.py' || name === 'asgi.py') {
    // Python WSGI/ASGI config
  }

  if (name === 'main.go' && fp.startsWith('cmd/')) {
    // Go entry points
  }

  if (name === 'main.rs' || name === 'lib.rs') {
    // Rust entry points
  }

  if (name === 'Application.java' || name === 'Program.cs') {
    // JVM/.NET entry points
  }

  if (name === 'config.ru') {
    // Ruby Rack entry point
  }

  // Config files
  if (name === 'Cargo.toml' || name === 'go.mod' || name === 'Gemfile' ||
      name === 'pom.xml' || name === 'build.gradle' || name === 'composer.json') {
    // Language-level config
  }

  // Infrastructure files
  if (name === 'Dockerfile' || name.startsWith('docker-compose') ||
      name.endsWith('.tf') || name.endsWith('.tfvars')) {
    result.deploymentTopology.infraFiles.push(name);
  }

  // CI/CD files
  if (fp.startsWith('.github/workflows/') || name === '.gitlab-ci.yml' ||
      name === 'Jenkinsfile') {
    result.deploymentTopology.infraFiles.push(fp);
  }

  // Data files
  if (name.endsWith('.sql')) {
    result.dataPipeline.schemaFiles.push(fp);
  }

  if (name.endsWith('.graphql') || name.endsWith('.gql') || name.endsWith('.proto')) {
    result.dataPipeline.schemaFiles.push(fp);
  }

  // Documentation files
  if (name.endsWith('.md') || name.endsWith('.rst')) {
    // Documentation
  }
});

// ============================================================================
// H. Deployment Topology Detection
// ============================================================================

result.deploymentTopology.hasDockerfile = fileNodes.some(n =>
  n.name === 'Dockerfile' || n.name.startsWith('Dockerfile.')
);
result.deploymentTopology.hasCompose = fileNodes.some(n =>
  n.name.startsWith('docker-compose')
);
result.deploymentTopology.hasK8s = fileNodes.some(n =>
  n.filePath.includes('k8s') || n.filePath.includes('kubernetes') ||
  n.name.endsWith('.yaml') && n.filePath.includes('helm')
);
result.deploymentTopology.hasTerraform = fileNodes.some(n =>
  n.name.endsWith('.tf') || n.name.endsWith('.tfvars')
);
result.deploymentTopology.hasCI = fileNodes.some(n =>
  n.filePath.startsWith('.github/workflows/') ||
  n.name === '.gitlab-ci.yml' ||
  n.name === 'Jenkinsfile'
);

// ============================================================================
// I. Data Pipeline Detection
// ============================================================================

result.dataPipeline.dataModelFiles = fileNodes
  .filter(n => n.filePath.includes('models') || n.filePath.includes('entities'))
  .map(n => n.filePath);

result.dataPipeline.apiHandlerFiles = fileNodes
  .filter(n => n.filePath.includes('routes') || n.filePath.includes('controllers') ||
              n.filePath.includes('handlers'))
  .map(n => n.filePath);

// ============================================================================
// J. Documentation Coverage
// ============================================================================

result.docCoverage.totalGroups = Object.keys(result.directoryGroups).length;

Object.keys(result.directoryGroups).forEach(group => {
  const groupNodes = result.directoryGroups[group];
  const hasDocs = groupNodes.some(nodeId => {
    const node = fileNodes.find(n => n.id === nodeId);
    return node && (node.type === 'document' || node.filePath.endsWith('.md'));
  });

  if (hasDocs) {
    result.docCoverage.groupsWithDocs++;
  } else {
    result.docCoverage.undocumentedGroups.push(group);
  }
});

result.docCoverage.coverageRatio = result.docCoverage.totalGroups > 0
  ? result.docCoverage.groupsWithDocs / result.docCoverage.totalGroups
  : 0;

// ============================================================================
// K. Dependency Direction
// ============================================================================

const groupImportCounts = {};

Object.keys(result.directoryGroups).forEach(group => {
  groupImportCounts[group] = { imports: {}, importedBy: {} };
});

importEdges.forEach(edge => {
  const sourceNode = fileNodes.find(n => n.id === edge.source);
  const targetNode = fileNodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) return;
  if (sourceNode.type !== 'file' || targetNode.type !== 'file') return;

  const sourceGroup = getGroupForNode(sourceNode.id);
  const targetGroup = getGroupForNode(targetNode.id);

  if (!sourceGroup || !targetGroup) return;
  if (sourceGroup === targetGroup) return;

  // source imports target
  if (!groupImportCounts[sourceGroup].imports[targetGroup]) {
    groupImportCounts[sourceGroup].imports[targetGroup] = 0;
  }
  groupImportCounts[sourceGroup].imports[targetGroup]++;

  // target is imported by source
  if (!groupImportCounts[targetGroup].importedBy[sourceGroup]) {
    groupImportCounts[targetGroup].importedBy[sourceGroup] = 0;
  }
  groupImportCounts[targetGroup].importedBy[sourceGroup]++;
});

// Determine dominant direction
const processedPairs = new Set();

Object.keys(groupImportCounts).forEach(group => {
  Object.keys(groupImportCounts[group].imports).forEach(targetGroup => {
    const pairKey = [group, targetGroup].sort().join('-');
    if (processedPairs.has(pairKey)) return;
    processedPairs.add(pairKey);

    const forward = groupImportCounts[group].imports[targetGroup] || 0;
    const backward = groupImportCounts[targetGroup].imports[group] || 0;

    if (forward > backward) {
      result.dependencyDirection.push({ dependent: group, dependsOn: targetGroup });
    } else if (backward > forward) {
      result.dependencyDirection.push({ dependent: targetGroup, dependsOn: group });
    }
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function getGroupForNode(nodeId) {
  for (const [group, nodes] of Object.entries(result.directoryGroups)) {
    if (nodes.includes(nodeId)) {
      return group;
    }
  }
  return null;
}

// ============================================================================
// Write Output
// ============================================================================

try {
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.error(`Architecture analysis complete. Results written to ${outputFile}`);
  process.exit(0);
} catch (err) {
  console.error(`Failed to write output file: ${err.message}`);
  process.exit(1);
}

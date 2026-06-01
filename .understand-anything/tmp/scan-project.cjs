const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = process.argv[2];
const outputFile = process.argv[3];

// 使用 git ls-files 获取文件列表
let files = [];
try {
  const gitFiles = execSync('git ls-files --exclude-standard', {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore']
  });
  files = gitFiles.split('\n').filter(f => f.trim());
} catch (e) {
  // 如果 git 失败，使用递归遍历
  console.warn('Git not available, using directory walk');
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(projectRoot, fullPath);
      if (entry.isDirectory() && !relPath.startsWith('node_modules') && !relPath.startsWith('.git')) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(relPath.replace(/\\/g, '/'));
      }
    }
  };
  walk(projectRoot);
}

// 语言和分类映射
const getLanguage = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const langMap = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.md': 'markdown',
    '.mdx': 'markdown',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.svg': 'svg',
    '.png': 'png',
    '.jpg': 'jpg',
    '.jpeg': 'jpg',
    '.gif': 'gif',
    '.ico': 'ico',
    '.woff': 'woff',
    '.woff2': 'woff2',
    '.ttf': 'ttf',
    '.eot': 'eot',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.ps1': 'powershell',
    '.bat': 'batch',
    '.cmd': 'batch',
    '.txt': 'text',
    '.lock': 'lock',
    '.gitignore': 'gitignore',
    '.npmignore': 'npmignore',
    '.eslintrc': 'eslintrc',
    '.prettierrc': 'prettierrc',
    '.editorconfig': 'editorconfig',
    '.browserslistrc': 'browserslistrc',
    'Dockerfile': 'dockerfile',
    'Makefile': 'makefile',
    'Jenkinsfile': 'jenkinsfile',
    'Procfile': 'procfile',
    'Vagrantfile': 'vagrantfile',
    '.gitattributes': 'gitattributes',
    '.cfignore': 'cfignore',
    '.dockerignore': 'dockerignore',
    '.env': 'env',
    '.env.local': 'env',
    '.env.*': 'env',
  };

  // 特殊文件名检查
  const basename = path.basename(filePath);
  if (basename === 'Dockerfile') return 'dockerfile';
  if (basename === 'Makefile') return 'makefile';
  if (basename === 'Jenkinsfile') return 'jenkinsfile';
  if (basename === 'Procfile') return 'procfile';
  if (basename === 'Vagrantfile') return 'vagrantfile';
  if (basename === '.gitignore') return 'gitignore';
  if (basename === '.npmignore') return 'npmignore';
  if (basename === '.gitattributes') return 'gitattributes';
  if (basename === '.dockerignore') return 'dockerignore';
  if (basename === '.cfignore') return 'cfignore';
  if (basename.startsWith('.env')) return 'env';
  if (basename === '.eslintrc' || basename === '.eslintrc.js' || basename === '.eslintrc.json') return 'eslintrc';
  if (basename === '.prettierrc' || basename === '.prettierrc.js' || basename === '.prettierrc.json') return 'prettierrc';
  if (basename === '.editorconfig') return 'editorconfig';
  if (basename === '.browserslistrc') return 'browserslistrc';

  // 扩展名映射
  return langMap[ext] || ext.slice(1) || 'unknown';
};

const getFileCategory = (filePath, language) => {
  const basename = path.basename(filePath);

  // 基础设施文件
  if (basename === 'Dockerfile' || basename.startsWith('Dockerfile.') ||
      basename.startsWith('docker-compose.') || basename === 'compose.yml' || basename === 'compose.yaml' ||
      basename === 'Makefile' || basename === 'Jenkinsfile' || basename === 'Procfile' || basename === 'Vagrantfile' ||
      basename === '.gitlab-ci.yml' || basename === '.dockerignore' ||
      filePath.includes('/k8s/') || filePath.includes('/kubernetes/') ||
      filePath.endsWith('.k8s.yml') || filePath.endsWith('.k8s.yaml') ||
      basename.endsWith('.tf') || basename.endsWith('.tfvars') ||
      filePath.startsWith('.github/workflows/') || filePath.startsWith('.circleci/')) {
    return 'infra';
  }

  // 文档文件
  if (basename.endsWith('.md') || basename.endsWith('.mdx') || basename.endsWith('.rst') ||
      basename.endsWith('.txt') || basename.endsWith('.text')) {
    if (basename !== 'LICENSE' && basename !== 'LICENSE.txt' && basename !== 'LICENSE.md') {
      return 'docs';
    }
  }

  // 配置文件
  if (basename.endsWith('.yaml') || basename.endsWith('.yml') || basename.endsWith('.json') ||
      basename.endsWith('.jsonc') || basename.endsWith('.toml') || basename.endsWith('.xml') ||
      basename.endsWith('.xsl') || basename.endsWith('.xsd') || basename.endsWith('.plist') ||
      basename.endsWith('.cfg') || basename.endsWith('.ini') || basename.endsWith('.env') ||
      basename.endsWith('.properties') || basename.endsWith('.csproj') || basename.endsWith('.sln') ||
      basename.endsWith('.mod') || basename.endsWith('.sum') || basename.endsWith('.gradle')) {
    return 'config';
  }

  // 数据文件
  if (basename.endsWith('.sql') || basename.endsWith('.graphql') || basename.endsWith('.gql') ||
      basename.endsWith('.proto') || basename.endsWith('.prisma') || basename.endsWith('.csv') ||
      basename.endsWith('.tsv')) {
    return 'data';
  }

  // 脚本文件
  if (basename.endsWith('.sh') || basename.endsWith('.bash') || basename.endsWith('.zsh') ||
      basename.endsWith('.ps1') || basename.endsWith('.psm1') || basename.endsWith('.psd1') ||
      basename.endsWith('.bat') || basename.endsWith('.cmd')) {
    return 'script';
  }

  // 样式文件
  if (basename.endsWith('.html') || basename.endsWith('.htm') || basename.endsWith('.css') ||
      basename.endsWith('.scss') || basename.endsWith('.sass') || basename.endsWith('.less')) {
    return 'markup';
  }

  // LICENSE 特殊处理（归类为 code）
  if (basename === 'LICENSE' || basename.startsWith('LICENSE.')) {
    return 'code';
  }

  // 默认为 code
  return 'code';
};

// 统计信息
const stats = {
  filesScanned: files.length,
  byCategory: { code: 0, config: 0, docs: 0, infra: 0, data: 0, script: 0, markup: 0 },
  byLanguage: {}
};

// 处理文件列表
const fileList = files.map(file => {
  const language = getLanguage(file);
  const fileCategory = getFileCategory(file, language);

  // 统计
  stats.byCategory[fileCategory] = (stats.byCategory[fileCategory] || 0) + 1;
  stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;

  // 尝试获取行数
  let sizeLines = 0;
  try {
    const fullPath = path.join(projectRoot, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    sizeLines = content.split('\n').length;
  } catch (e) {
    sizeLines = 0;
  }

  return {
    path: file,
    language,
    sizeLines,
    fileCategory
  };
});

// 估算复杂度
const complexityLevels = {
  simple: 50,
  moderate: 200,
  complex: 500
};
let estimatedComplexity = 'simple';
if (files.length > complexityLevels.simple) estimatedComplexity = 'moderate';
if (files.length > complexityLevels.moderate) estimatedComplexity = 'complex';
if (files.length > complexityLevels.complex) estimatedComplexity = 'very-complex';

// 输出结果
const result = {
  scriptCompleted: true,
  files: fileList.sort((a, b) => a.path.localeCompare(b.path)),
  totalFiles: files.length,
  filteredByIgnore: 0,
  estimatedComplexity,
  stats
};

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log(`Scanned ${files.length} files`);

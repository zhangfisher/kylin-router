#!/usr/bin/env node

/**
 * Tour Builder Graph Analysis Script
 *
 * This script analyzes the topology of a codebase graph to identify:
 * - Entry points (files that start the application)
 * - Fan-in/fan-out rankings (importance and scope)
 * - BFS traversal from entry points (natural reading order)
 * - Tightly coupled clusters (features that belong together)
 * - Non-code files (documentation, infrastructure, configuration)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  if (process.argv.length < 4) {
    console.error('Usage: node ua-tour-analyze.js <input.json> <output.json>');
    process.exit(1);
  }

  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  try {
    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    // Normalize input structure to handle both new and old formats
    let nodes = [];
    let edges = [];
    let layers = [];

    if (inputData.fileNodes) {
      nodes = inputData.fileNodes;
      edges = inputData.edges || [];
      layers = inputData.layers || [];
    } else if (inputData.nodes) {
      nodes = inputData.nodes;
      edges = inputData.edges || [];
      layers = inputData.layers || [];
    } else {
      throw new Error('Invalid input format: missing nodes or fileNodes');
    }

    console.error(`Processing ${nodes.length} nodes and ${edges.length} edges...`);

    const result = {
      scriptCompleted: true,
      entryPointCandidates: analyzeEntryPoints(nodes, edges),
      fanInRanking: analyzeFanIn(nodes, edges),
      fanOutRanking: analyzeFanOut(nodes, edges),
      bfsTraversal: analyzeBFS(nodes, edges),
      nonCodeFiles: analyzeNonCodeFiles(nodes),
      clusters: analyzeClusters(nodes, edges),
      layers: analyzeLayers(layers),
      nodeSummaryIndex: buildSummaryIndex(nodes),
      totalNodes: nodes.length,
      totalEdges: edges.length
    };

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.error(`Analysis complete. Results written to ${outputPath}`);
    process.exit(0);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Build a lookup index for node summaries
 */
function buildSummaryIndex(nodes) {
  const index = {};
  for (const node of nodes) {
    index[node.id] = {
      name: node.name,
      type: node.type,
      summary: node.summary
    };
  }
  return index;
}

/**
 * Analyze potential entry points
 */
function analyzeEntryPoints(nodes, edges) {
  const candidates = [];

  // Calculate fan-in and fan-out for scoring
  const fanIn = {};
  const fanOut = {};
  const fanInValues = [];

  for (const node of nodes) {
    fanIn[node.id] = 0;
    fanOut[node.id] = 0;
  }

  for (const edge of edges) {
    if (fanIn[edge.target] !== undefined) fanIn[edge.target]++;
    if (fanOut[edge.source] !== undefined) fanOut[edge.source]++;
  }

  for (const id in fanIn) {
    fanInValues.push(fanIn[id]);
  }

  fanInValues.sort((a, b) => a - b);
  const fanInBottom25 = fanInValues[Math.floor(fanInValues.length * 0.25)] || 0;
  const fanOutTop10 = fanInValues[Math.floor(fanInValues.length * 0.9)] || 0;

  const entryFileNames = [
    'index.ts', 'index.js', 'index.tsx', 'index.jsx',
    'main.ts', 'main.js', 'main.tsx', 'main.jsx',
    'app.ts', 'app.js', 'app.tsx', 'app.jsx',
    'server.ts', 'server.js',
    'mod.rs', 'main.go', 'main.py', 'main.rs',
    'manage.py', 'app.py', 'wsgi.py', 'asgi.py', 'run.py',
    '__main__.py', 'Application.java', 'Main.java',
    'Program.cs', 'config.ru', 'index.php',
    'App.swift', 'Application.kt', 'main.cpp', 'main.c'
  ];

  for (const node of nodes) {
    if (node.type !== 'file') continue;

    let score = 0;
    const fileName = node.name.toLowerCase();
    const filePath = node.filePath.toLowerCase();

    // Entry file pattern
    if (entryFileNames.includes(fileName)) {
      score += 3;
    }

    // Root or shallow depth
    if (!filePath.includes('/') || filePath.split('/').length <= 2) {
      score += 1;
    }

    // High fan-out (broad scope)
    if (fanOut[node.id] >= fanOutTop10) {
      score += 1;
    }

    // Low fan-in (imported by few, likely entry)
    if (fanIn[node.id] <= fanInBottom25) {
      score += 1;
    }

    if (score > 0) {
      candidates.push({
        id: node.id,
        score: score,
        name: node.name,
        summary: node.summary
      });
    }
  }

  // Add documentation entry points
  for (const node of nodes) {
    if (node.type !== 'document') continue;

    let score = 0;
    if (node.name.toLowerCase() === 'readme.md' && node.filePath.toLowerCase() === 'readme.md') {
      score = 5;
    } else if (node.filePath.split('/').length <= 1) {
      score = 2;
    }

    if (score > 0) {
      candidates.push({
        id: node.id,
        score: score,
        name: node.name,
        summary: node.summary
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Analyze fan-in (importance) ranking
 */
function analyzeFanIn(nodes, edges) {
  const fanIn = {};

  for (const node of nodes) {
    fanIn[node.id] = 0;
  }

  for (const edge of edges) {
    if (fanIn[edge.target] !== undefined) {
      fanIn[edge.target]++;
    }
  }

  const ranking = [];
  for (const node of nodes) {
    ranking.push({
      id: node.id,
      fanIn: fanIn[node.id],
      name: node.name
    });
  }

  return ranking.sort((a, b) => b.fanIn - a.fanIn).slice(0, 20);
}

/**
 * Analyze fan-out (scope) ranking
 */
function analyzeFanOut(nodes, edges) {
  const fanOut = {};

  for (const node of nodes) {
    fanOut[node.id] = 0;
  }

  for (const edge of edges) {
    if (fanOut[edge.source] !== undefined) {
      fanOut[edge.source]++;
    }
  }

  const ranking = [];
  for (const node of nodes) {
    ranking.push({
      id: node.id,
      fanOut: fanOut[node.id],
      name: node.name
    });
  }

  return ranking.sort((a, b) => b.fanOut - a.fanOut).slice(0, 20);
}

/**
 * Analyze BFS traversal from top entry point
 */
function analyzeBFS(nodes, edges) {
  // Find the top code entry point (skip documentation)
  const candidates = analyzeEntryPoints(nodes, edges);
  const codeEntry = candidates.find(c => c.id.startsWith('file:')) || candidates[0];

  if (!codeEntry) {
    return {
      startNode: null,
      order: [],
      depthMap: {},
      byDepth: {}
    };
  }

  const startNode = codeEntry.id;

  // Build adjacency list for imports/calls edges
  const adj = {};
  for (const node of nodes) {
    adj[node.id] = [];
  }

  for (const edge of edges) {
    if (edge.type === 'imports' || edge.type === 'calls') {
      if (adj[edge.source] !== undefined) {
        adj[edge.source].push(edge.target);
      }
    }
  }

  // BFS traversal
  const visited = new Set();
  const order = [];
  const depthMap = {};
  const byDepth = {};
  const queue = [{node: startNode, depth: 0}];

  while (queue.length > 0) {
    const {node, depth} = queue.shift();

    if (visited.has(node)) continue;
    visited.add(node);

    order.push(node);
    depthMap[node] = depth;

    if (!byDepth[depth]) {
      byDepth[depth] = [];
    }
    byDepth[depth].push(node);

    for (const neighbor of adj[node] || []) {
      if (!visited.has(neighbor)) {
        queue.push({node: neighbor, depth: depth + 1});
      }
    }
  }

  return {
    startNode,
    order,
    depthMap,
    byDepth
  };
}

/**
 * Analyze non-code files by category
 */
function analyzeNonCodeFiles(nodes) {
  const result = {
    documentation: [],
    infrastructure: [],
    data: [],
    config: []
  };

  for (const node of nodes) {
    if (node.type === 'document') {
      result.documentation.push({
        id: node.id,
        name: node.name,
        summary: node.summary
      });
    } else if (node.type === 'service' || node.type === 'pipeline' || node.type === 'resource') {
      result.infrastructure.push({
        id: node.id,
        name: node.name,
        summary: node.summary
      });
    } else if (node.type === 'table' || node.type === 'schema' || node.type === 'endpoint') {
      result.data.push({
        id: node.id,
        name: node.name,
        summary: node.summary
      });
    } else if (node.type === 'config') {
      result.config.push({
        id: node.id,
        name: node.name,
        summary: node.summary
      });
    }
  }

  return result;
}

/**
 * Analyze tightly coupled clusters
 */
function analyzeClusters(nodes, edges) {
  // Build adjacency for bidirectional relationships
  const adj = {};
  const edgeCounts = {};

  for (const node of nodes) {
    adj[node.id] = new Set();
  }

  // Count bidirectional edges
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}`;
    if (!edgeCounts[key]) {
      edgeCounts[key] = 0;
    }
    edgeCounts[key]++;

    // Initialize adj for nodes that don't exist yet
    if (!adj[edge.source]) {
      adj[edge.source] = new Set();
    }
    if (!adj[edge.target]) {
      adj[edge.target] = new Set();
    }

    // Check for reverse edge
    const reverseKey = `${edge.target}|${edge.source}`;
    if (edgeCounts[reverseKey]) {
      adj[edge.source].add(edge.target);
      adj[edge.target].add(edge.source);
    }
  }

  // Find clusters using connected components
  const visited = new Set();
  const clusters = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const cluster = [];
    const queue = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift();
      cluster.push(current);

      for (const neighbor of adj[current] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (cluster.length >= 2 && cluster.length <= 5) {
      // Count edges within cluster
      let edgeCount = 0;
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          const key1 = `${cluster[i]}|${cluster[j]}`;
          const key2 = `${cluster[j]}|${cluster[i]}`;
          edgeCount += (edgeCounts[key1] || 0) + (edgeCounts[key2] || 0);
        }
      }

      clusters.push({
        nodes: cluster,
        edgeCount
      });
    }
  }

  return clusters.sort((a, b) => b.edgeCount - a.edgeCount).slice(0, 10);
}

/**
 * Analyze layers
 */
function analyzeLayers(layers) {
  return {
    count: layers.length,
    list: layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      description: layer.description
    }))
  };
}

main();

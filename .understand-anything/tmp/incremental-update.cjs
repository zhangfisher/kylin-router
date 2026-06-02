#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.argv[2];
const changedFilesList = [
  'src/components/outlet/index.ts',
  'src/directives/injectData.ts',
  'src/features/baseLoader.ts',
  'src/router.ts',
  'src/types/config.ts',
  'src/utils/matchRoute.ts',
  'example/public/shop/index.html',
  'example/public/shop/pages/product-list.html',
  'src/__tests__/features.data.test.ts',
  'src/__tests__/features.loaddata.test.ts',
  'src/__tests__/features.loadview.test.ts',
  'src/__tests__/test-setup.ts',
  'src/__tests__/utils.matchRoute.test.ts'
];

const graphPath = path.join(projectRoot, '.understand-anything/knowledge-graph.json');
const existingOutputPath = path.join(projectRoot, '.understand-anything/intermediate/batch-existing.json');

console.log('Reading existing knowledge graph...');
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

console.log('Filtering out changed files...');
const changedFileIds = new Set(changedFilesList.map(f => {
  // Handle different file types
  if (f.endsWith('.html')) return `document:${f}`;
  if (f.startsWith('src/__tests__/')) return `file:${f}`;
  return `file:${f}`;
}));

const filteredNodes = graph.nodes.filter(n => !changedFileIds.has(n.id));
const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

const filteredEdges = graph.edges.filter(e =>
  filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
);

const existingGraph = {
  nodes: filteredNodes,
  edges: filteredEdges
};

console.log(`Writing ${filteredNodes.length} nodes and ${filteredEdges.length} edges to batch-existing.json`);
fs.writeFileSync(existingOutputPath, JSON.stringify(existingGraph, null, 2));

console.log('Incremental update preprocessing complete');

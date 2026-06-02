#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.argv[2];
const assembledPath = path.join(projectRoot, '.understand-anything/intermediate/assembled-graph.json');
const existingPath = path.join(projectRoot, '.understand-anything/intermediate/batch-existing.json');
const outputPath = path.join(projectRoot, '.understand-anything/intermediate/assembled-graph.json');

console.log('Reading assembled graph...');
const assembled = JSON.parse(fs.readFileSync(assembledPath, 'utf8'));

console.log('Reading existing graph...');
const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));

console.log('Merging nodes and edges...');
const assembledNodeIds = new Set(assembled.nodes.map(n => n.id));
const assembledEdgeKey = new Set(assembled.edges.map(e => `${e.source}|${e.target}|${e.type}`));

// Add nodes from existing that aren't in assembled
const newNodes = existing.nodes.filter(n => !assembledNodeIds.has(n.id));
const newNodeIds = new Set(newNodes.map(n => n.id));

// Add edges from existing that aren't in assembled and whose endpoints exist
const newEdges = existing.edges.filter(e => {
  const key = `${e.source}|${e.target}|${e.type}`;
  if (assembledEdgeKey.has(key)) return false;
  const allIds = new Set([...assembledNodeIds, ...newNodeIds]);
  return allIds.has(e.source) && allIds.has(e.target);
});

const merged = {
  nodes: [...assembled.nodes, ...newNodes],
  edges: [...assembled.edges, ...newEdges]
};

console.log(`Merged: ${merged.nodes.length} nodes (+${newNodes.length}), ${merged.edges.length} edges (+${newEdges.length})`);
fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));

console.log('Merge complete');

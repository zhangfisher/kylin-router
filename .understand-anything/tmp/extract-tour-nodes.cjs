#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const graphPath = process.argv[2];
const layersPath = process.argv[3];
const outputPath = process.argv[4];

const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));

// Extract file-level nodes for tour
const fileLevelTypes = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);
const fileNodes = graph.nodes.filter(n => fileLevelTypes.has(n.type));

// Extract all edges
const allEdges = graph.edges;

// Extract layer info (without nodeIds)
const layerInfo = layers.map(l => ({
  id: l.id,
  name: l.name,
  description: l.description
}));

const output = {
  fileNodes: fileNodes.map(n => ({
    id: n.id,
    name: n.name,
    filePath: n.filePath,
    summary: n.summary,
    type: n.type
  })),
  layers: layerInfo,
  edges: allEdges
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Extracted ${fileNodes.length} file nodes, ${layerInfo.length} layers, and ${allEdges.length} edges for tour`);

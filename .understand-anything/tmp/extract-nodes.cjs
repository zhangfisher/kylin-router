#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const graphPath = process.argv[2];
const outputPath = process.argv[3];

const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

// Extract file-level nodes only
const fileLevelTypes = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);
const fileNodes = graph.nodes.filter(n => fileLevelTypes.has(n.type));

// Extract all edges
const allEdges = graph.edges;
const importEdges = graph.edges.filter(e => e.type === 'imports');

const output = {
  fileNodes: fileNodes.map(n => ({
    id: n.id,
    type: n.type,
    name: n.name,
    filePath: n.filePath,
    summary: n.summary,
    tags: n.tags
  })),
  importEdges: importEdges,
  allEdges: allEdges
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Extracted ${fileNodes.length} file nodes and ${allEdges.length} edges`);

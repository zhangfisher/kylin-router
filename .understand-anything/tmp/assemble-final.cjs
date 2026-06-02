#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.argv[2];
const assembledPath = path.join(projectRoot, '.understand-anything/intermediate/assembled-graph.json');
const layersPath = path.join(projectRoot, '.understand-anything/intermediate/layers.json');
const tourPath = path.join(projectRoot, '.understand-anything/intermediate/tour.json');
const graphPath = path.join(projectRoot, '.understand-anything/knowledge-graph.json');
const metaPath = path.join(projectRoot, '.understand-anything/meta.json');

console.log('Reading assembled graph...');
const assembled = JSON.parse(fs.readFileSync(assembledPath, 'utf8'));

console.log('Reading layers...');
const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));

console.log('Reading tour...');
const tour = JSON.parse(fs.readFileSync(tourPath, 'utf8'));

// Read existing meta for project info
let projectName = "kylin-router";
let projectLanguages = ["typescript", "markdown", "javascript", "html", "css", "json"];
let projectFrameworks = ["Lit", "History API", "Vite", "TypeScript", "Bun test"];
let projectDescription = "Kylin Router — A modern frontend router library for Web Components";

if (fs.existsSync(metaPath)) {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  projectName = meta.project?.name || projectName;
  projectLanguages = meta.project?.languages || projectLanguages;
  projectFrameworks = meta.project?.frameworks || projectFrameworks;
  projectDescription = meta.project?.description || projectDescription;
}

// Get current git commit
const { execSync } = require('child_process');
let gitCommitHash = "unknown";
try {
  gitCommitHash = execSync('git rev-parse HEAD', { cwd: projectRoot, encoding: 'utf8' }).trim();
} catch (e) {
  console.warn('Could not get git commit hash');
}

// Validate and normalize layers
function normalizeLayers(layers, nodeIds) {
  const nodeIdSet = new Set(nodeIds);
  return layers.map(layer => {
    // Handle envelope format
    const layerData = Array.isArray(layer) ? layer : (layer.layers || layer);
    const normalizedLayer = Array.isArray(layerData) ? { layers: layerData } : layerData;

    // Convert nodes to nodeIds if needed
    if (normalizedLayer.nodes && !normalizedLayer.nodeIds) {
      if (Array.isArray(normalizedLayer.nodes) && normalizedLayer.nodes.length > 0) {
        if (typeof normalizedLayer.nodes[0] === 'object' && normalizedLayer.nodes[0].id) {
          normalizedLayer.nodeIds = normalizedLayer.nodes.map(n => n.id);
        } else {
          normalizedLayer.nodeIds = normalizedLayer.nodes;
        }
      } else {
        normalizedLayer.nodeIds = [];
      }
      delete normalizedLayer.nodes;
    }

    // Convert file paths to file: prefix if needed
    if (normalizedLayer.nodeIds) {
      normalizedLayer.nodeIds = normalizedLayer.nodeIds.map(id => {
        if (typeof id === 'string' && !id.includes(':')) {
          return `file:${id}`;
        }
        return id;
      }).filter(id => nodeIdSet.has(id)); // Drop dangling refs
    }

    // Generate ID if missing
    if (!normalizedLayer.id) {
      const kebabName = normalizedLayer.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      normalizedLayer.id = `layer:${kebabName}`;
    }

    return normalizedLayer;
  });
}

// Validate and normalize tour
function normalizeTour(tour, nodeIds) {
  const nodeIdSet = new Set(nodeIds);
  return tour.map(step => {
    const normalized = { ...step };

    // Handle envelope format
    if (normalized.steps && Array.isArray(normalized.steps)) {
      return normalized.steps;
    }

    // Convert nodesToInspect to nodeIds if needed
    if (normalized.nodesToInspect && !normalized.nodeIds) {
      normalized.nodeIds = normalized.nodesToInspect;
      delete normalized.nodesToInspect;
    }

    // Convert whyItMatters to description if needed
    if (normalized.whyItMatters && !normalized.description) {
      normalized.description = normalized.whyItMatters;
      delete normalized.whyItMatters;
    }

    // Convert file paths to file: prefix if needed
    if (normalized.nodeIds) {
      normalized.nodeIds = normalized.nodeIds.map(id => {
        if (typeof id === 'string' && !id.includes(':')) {
          return `file:${id}`;
        }
        return id;
      }).filter(id => nodeIdSet.has(id)); // Drop dangling refs
    }

    return normalized;
  }).sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Get all node IDs from assembled graph
const allNodeIds = assembled.nodes.map(n => n.id);

// Normalize layers and tour
const normalizedLayers = normalizeLayers(layers, allNodeIds);
const normalizedTour = normalizeTour(tour, allNodeIds);

// Validate required fields
const layersValidation = normalizedLayers.every(l =>
  l.id && l.name && l.description && Array.isArray(l.nodeIds)
);

const tourValidation = normalizedTour.every(t =>
  typeof t.order === 'number' && t.title && t.description && Array.isArray(t.nodeIds)
);

if (!layersValidation) {
  console.error('Layers validation failed');
  process.exit(1);
}

if (!tourValidation) {
  console.error('Tour validation failed');
  process.exit(1);
}

// Assemble final graph
const finalGraph = {
  version: "1.0.0",
  project: {
    name: projectName,
    languages: projectLanguages,
    frameworks: projectFrameworks,
    description: projectDescription,
    analyzedAt: new Date().toISOString(),
    gitCommitHash: gitCommitHash
  },
  nodes: assembled.nodes,
  edges: assembled.edges,
  layers: normalizedLayers,
  tour: normalizedTour
};

console.log(`Writing final graph with ${finalGraph.nodes.length} nodes, ${finalGraph.edges.length} edges, ${finalGraph.layers.length} layers, ${finalGraph.tour.length} tour steps`);
fs.writeFileSync(graphPath, JSON.stringify(finalGraph, null, 2));
console.log('Final graph written to', graphPath);

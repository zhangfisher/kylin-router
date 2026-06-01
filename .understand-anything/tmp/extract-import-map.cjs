const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];
const projectRoot = JSON.parse(fs.readFileSync(inputFile, 'utf-8')).projectRoot;

// 读取输入文件
const input = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
const files = input.files;

// 简化的 import 提取 - 只处理 TypeScript/JavaScript 文件
const extractImports = (file, projectRoot) => {
  const filePath = path.join(projectRoot, file.path);
  const imports = [];

  // 只处理代码文件
  if (file.fileCategory !== 'code' || !file.language.match(/typescript|javascript/)) {
    return imports;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 简单的 import 匹配（不含类型导入）
    const importPatterns = [
      // ES6 imports
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
      // CommonJS requires
      /require\(['"]([^'"]+)['"]\)/g
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        // 只保留相对路径导入（内部依赖）
        if (importPath.startsWith('.') || importPath.startsWith('@/')) {
          imports.push(importPath);
        }
      }
    }
  } catch (e) {
    // 文件读取失败，返回空数组
  }

  return imports;
};

// 处理所有文件
const importMap = {};
let filesWithImports = 0;
let totalEdges = 0;

files.forEach(file => {
  const imports = extractImports(file, projectRoot);
  importMap[file.path] = imports;

  if (imports.length > 0) {
    filesWithImports++;
    totalEdges += imports.length;
  }
});

// 输出结果
const result = {
  scriptCompleted: true,
  stats: {
    filesScanned: files.length,
    filesWithImports,
    totalEdges
  },
  importMap
};

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log(`Extracted imports: ${filesWithImports} files with ${totalEdges} import relationships`);

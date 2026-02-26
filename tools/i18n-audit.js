import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const TRANSLATIONS_PATH = path.resolve(process.cwd(), 'src/lib/translations.js');

const JS_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (JS_EXTS.has(path.extname(entry.name))) yield fullPath;
  }
}

function loadTranslations() {
  // ESM import path must be file URL
  const url = new URL(`file://${TRANSLATIONS_PATH.replace(/\\/g, '/')}`);
  return import(url.href).then((m) => m.translations);
}

function extractUsedKeys() {
  const keyRegex = /\bt\(\s*(['"])([^'"\n\r]+)\1\s*\)/g;
  const used = new Map(); // key -> Set(files)

  for (const absPath of walk(SRC_ROOT)) {
    const rel = path.relative(process.cwd(), absPath);
    const text = fs.readFileSync(absPath, 'utf8');
    let match;
    while ((match = keyRegex.exec(text))) {
      const key = match[2];
      const files = used.get(key) ?? new Set();
      if (files.size < 5) files.add(rel);
      used.set(key, files);
    }
  }

  return used;
}

function analyzeTranslationDuplicates() {
  const code = fs.readFileSync(TRANSLATIONS_PATH, 'utf8');
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });

  let translationsNode = null;
  traverse.default(ast, {
    ExportNamedDeclaration(p) {
      const decl = p.node.declaration;
      if (!decl || decl.type !== 'VariableDeclaration') return;
      for (const d of decl.declarations) {
        if (d.id.type === 'Identifier' && d.id.name === 'translations') {
          translationsNode = d.init;
        }
      }
    },
  });

  if (!translationsNode || translationsNode.type !== 'ObjectExpression') {
    return { error: 'Could not find exported translations object' };
  }

  const result = {};

  function propKey(prop) {
    if (prop.key.type === 'Identifier' && !prop.computed) return prop.key.name;
    if (prop.key.type === 'StringLiteral') return prop.key.value;
    return null;
  }

  function stringValue(node) {
    if (!node) return null;
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
      return node.quasis.map((q) => q.value.cooked).join('');
    }
    return null;
  }

  for (const langProp of translationsNode.properties) {
    if (langProp.type !== 'ObjectProperty') continue;
    const lang = propKey(langProp);
    if (!lang) continue;
    if (langProp.value.type !== 'ObjectExpression') continue;

    const seen = new Map(); // key -> [values]
    for (const prop of langProp.value.properties) {
      if (prop.type !== 'ObjectProperty') continue;
      const key = propKey(prop);
      if (!key) continue;
      const val = stringValue(prop.value);
      const arr = seen.get(key) ?? [];
      arr.push(val ?? '<non-string>');
      seen.set(key, arr);
    }

    const duplicateKeys = [];
    const duplicatesWithDifferentValues = [];
    for (const [key, values] of seen.entries()) {
      if (values.length <= 1) continue;
      duplicateKeys.push(key);
      const uniq = [...new Set(values)];
      if (uniq.length > 1) {
        duplicatesWithDifferentValues.push({ key, count: values.length, uniq });
      }
    }

    duplicatesWithDifferentValues.sort((a, b) => b.count - a.count || b.uniq.length - a.uniq.length);

    result[lang] = {
      duplicateKeys: duplicateKeys.length,
      duplicatesWithDifferentValues: duplicatesWithDifferentValues.length,
      sampleDifferentValues: duplicatesWithDifferentValues.slice(0, 20),
    };
  }

  return result;
}

function formatKeyList(keys) {
  return keys.length ? keys.join('\n') : '(none)';
}

function main() {
  return loadTranslations().then((translations) => {
    const used = extractUsedKeys();
    const usedKeys = [...used.keys()].sort();
    const langs = Object.keys(translations);

    const missingAllLangs = [];
    const partialMissing = [];
    for (const key of usedKeys) {
      const present = langs.filter((lang) => Object.prototype.hasOwnProperty.call(translations[lang], key));
      if (present.length === 0) missingAllLangs.push(key);
      else if (present.length !== langs.length) partialMissing.push({ key, present });
    }

    const missingByLang = Object.fromEntries(langs.map((lang) => [lang, []]));
    for (const { key, present } of partialMissing) {
      for (const lang of langs) {
        if (!present.includes(lang)) missingByLang[lang].push(key);
      }
    }

    const snakeCaseUsed = usedKeys.filter((k) => k.includes('_'));

    console.log('=== i18n audit ===');
    console.log('translations file:', path.relative(process.cwd(), TRANSLATIONS_PATH));
    console.log('src root:', path.relative(process.cwd(), SRC_ROOT));
    console.log('languages:', langs.join(', '));
    console.log('used keys:', usedKeys.length);
    console.log('missing in ALL languages:', missingAllLangs.length);
    console.log('partial missing:', partialMissing.length);
    console.log('snake_case used keys:', snakeCaseUsed.length);

    if (snakeCaseUsed.length) {
      console.log('\n--- snake_case keys used (review for mismatches) ---');
      console.log(formatKeyList(snakeCaseUsed.slice(0, 200)));
      if (snakeCaseUsed.length > 200) console.log(`... (${snakeCaseUsed.length - 200} more)`);
    }

    if (missingAllLangs.length) {
      console.log('\n--- missing in ALL languages ---');
      for (const key of missingAllLangs) {
        const files = [...(used.get(key) ?? [])];
        console.log(`- ${key}  (e.g. ${files.slice(0, 3).join(', ')})`);
      }
    }

    if (partialMissing.length) {
      console.log('\n--- partial missing (present in some languages) ---');
      for (const { key, present } of partialMissing) {
        console.log(`- ${key}  (present in: ${present.join(', ')})`);
      }
    }

    console.log('\n--- missing keys by language (partial only) ---');
    for (const lang of langs) {
      console.log(`${lang}: ${missingByLang[lang].length}`);
    }

    const dupes = analyzeTranslationDuplicates();
    console.log('\n--- translations.js duplicates (FYI) ---');
    console.log(JSON.stringify(dupes, null, 2));

    const exitCode = missingAllLangs.length || partialMissing.length ? 1 : 0;
    process.exitCode = exitCode;
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 2;
});


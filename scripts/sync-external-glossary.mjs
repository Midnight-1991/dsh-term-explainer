#!/usr/bin/env node
/**
 * Build data/external-glossary.json from the upstream term libraries.
 *
 * The upstream repositories are NOT vendored into this repo. Prepare them once:
 *
 *   mkdir -p /tmp/glossary-src && cd /tmp/glossary-src
 *   git clone --depth 1 --filter=blob:none --sparse https://github.com/kubernetes/website.git k8s-website
 *   (cd k8s-website && git sparse-checkout set content/zh-cn/docs/reference/glossary content/en/docs/reference/glossary LICENSE)
 *   git clone --depth 1 --filter=blob:none --sparse https://github.com/cncf/glossary.git cncf-glossary
 *   (cd cncf-glossary && git sparse-checkout set content/zh-cn content/en LICENSE)
 *   git clone --depth 1 https://github.com/YqqLikeGit/ai-heihua-zh.git ai-heihua
 *
 * Then:
 *
 *   node scripts/sync-external-glossary.mjs /tmp/glossary-src
 *
 * Only permissive sources are accepted: CC-BY-4.0 (Kubernetes website docs),
 * Apache-2.0 (CNCF glossary) and MIT (ai-heihua-zh). CC-BY-SA and CC-BY-NC
 * sources are deliberately not used here.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcesDir = resolve(process.argv[2] || process.env.GLOSSARY_SRC || '');
if (!process.argv[2] && !process.env.GLOSSARY_SRC) {
  console.error('usage: node scripts/sync-external-glossary.mjs <glossary-src-dir>');
  process.exit(1);
}

const CATEGORY_KEYS = new Set(['lang', 'web', 'server', 'db', 'net', 'devops', 'security', 'ai', 'system', 'practice', 'harness']);
const SEEN = new Set();

/** Normalised identity: case, parenthesised Latin suffix and spacing are ignored. */
function dedupeKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s_\-]/g, '');
}

function rowsOf(text) {
  return text.replace(/\r/g, '').split('\n');
}

/** Minimal front-matter parser: scalars, folded scalars (`>`) and `- item` lists. */
function parseFrontmatter(text) {
  const lines = rowsOf(text);
  if (lines[0].trim() !== '---') return { data: {}, body: text };
  let end = 1;
  while (end < lines.length && lines[end].trim() !== '---') end += 1;
  const head = lines.slice(1, end);
  const body = lines.slice(end + 1).join('\n');
  const data = {};
  for (let index = 0; index < head.length; index += 1) {
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(head[index]);
    if (!match) continue;
    const key = match[1];
    const raw = match[2].trim();
    if (raw === '>' || raw === '|') {
      const buffer = [];
      let cursor = index + 1;
      while (cursor < head.length && /^\s+/.test(head[cursor])) {
        buffer.push(head[cursor].trim());
        cursor += 1;
      }
      data[key] = buffer.join(raw === '|' ? '\n' : ' ').trim();
      index = cursor - 1;
      continue;
    }
    if (raw === '') {
      const items = [];
      let cursor = index + 1;
      while (cursor < head.length && /^\s*-\s+/.test(head[cursor])) {
        items.push(head[cursor].replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
        cursor += 1;
      }
      data[key] = items;
      index = cursor - 1;
      continue;
    }
    data[key] = raw.replace(/^['"]|['"]$/g, '');
  }
  return { data, body };
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, ' ');
}

function cleanText(text) {
  return String(text || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDefinition(text, max = 150) {
  let value = cleanText(text);
  if (!value) return '';
  // Keep the lead sentence(s); stop on the first two Chinese periods when long.
  if (value.length > max) {
    const cut = value.slice(0, max);
    const stop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('，'));
    value = (stop > 40 ? cut.slice(0, stop) : cut).trim();
  }
  value = value.replace(/[，；、]$/, '').trim();
  if (value && !/[。！？]$/.test(value)) value += '。';
  return value;
}

function cleanTerm(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function englishFromChineseTitle(title) {
  const match = /[（(]([A-Za-z][^）)]*)[）)]\s*$/.exec(title);
  return match ? match[1].trim() : '';
}

function add({ term, full, category, explanation, aliases = [], source }) {
  term = cleanTerm(term);
  explanation = cleanDefinition(explanation);
  full = cleanTerm(full);
  if (!term || term.length > 24) return false;
  if (!explanation || explanation.length < 6) return false;
  if (!CATEGORY_KEYS.has(category)) return false;
  const key = dedupeKey(term);
  if (SEEN.has(key)) return false;
  SEEN.add(key);
  const aliasSet = [];
  for (const alias of [full, ...aliases]) {
    const value = cleanTerm(alias);
    if (!value || value === term) continue;
    const lower = value.toLowerCase();
    if (aliasSet.some((item) => item.toLowerCase() === lower)) continue;
    if (value.length > 40) continue;
    aliasSet.push(value);
  }
  entries.push([term, full, category, explanation, aliasSet.length ? { aliases: aliasSet } : undefined, source]);
  return true;
}

const entries = [];
const sources = [];

function gitCommit(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/* ------------------------------------------------------ Kubernetes website */

const k8sDir = join(sourcesDir, 'k8s-website');
const k8sZhDir = join(k8sDir, 'content/zh-cn/docs/reference/glossary');
const k8sEnDir = join(k8sDir, 'content/en/docs/reference/glossary');
let k8sAdded = 0;
const K8S_CATEGORY = {
  security: 'security',
  networking: 'net',
  tool: 'devops',
  extension: 'devops',
  operation: 'devops',
  'core-object': 'devops',
  architecture: 'devops',
  workload: 'devops',
  fundamental: 'system',
  community: 'practice',
};
for (const file of readdirSync(k8sZhDir).filter((name) => name.endsWith('.md'))) {
  const zh = parseFrontmatter(readFileSync(join(k8sZhDir, file), 'utf8')).data;
  let enTitle = '';
  try {
    enTitle = parseFrontmatter(readFileSync(join(k8sEnDir, file), 'utf8')).data.title || '';
  } catch {
    /* English mirror is optional */
  }
  const tags = Array.isArray(zh.tags) ? zh.tags : [];
  const category = (tags.find((tag) => K8S_CATEGORY[tag]) && K8S_CATEGORY[tags.find((tag) => K8S_CATEGORY[tag])]) || 'devops';
  const title = cleanTerm(zh.title);
  const chineseTerm = title.replace(/[（(][A-Za-z][^）)]*[）)]\s*$/, '').trim() || title;
  const aka = Array.isArray(zh.aka) ? zh.aka : [];
  if (
    add({
      term: chineseTerm,
      full: enTitle || englishFromChineseTitle(title),
      category,
      explanation: zh.short_description,
      aliases: [englishFromChineseTitle(title), ...aka],
      source: 'kubernetes-website',
    })
  ) {
    k8sAdded += 1;
  }
}
sources.push({
  id: 'kubernetes-website',
  repo: 'https://github.com/kubernetes/website',
  path: 'content/zh-cn/docs/reference/glossary',
  license: 'CC-BY-4.0',
  commit: gitCommit(k8sDir),
  added: k8sAdded,
});

/* ------------------------------------------------------------- CNCF glossary */

const cncfDir = join(sourcesDir, 'cncf-glossary');
const cncfZhDir = join(cncfDir, 'content/zh-cn');
const cncfEnDir = join(cncfDir, 'content/en');
const CNCF_TAG_CATEGORY = {
  网络: 'net',
  安全: 'security',
  可观测性: 'devops',
  基础设施: 'devops',
  应用程序: 'web',
  方法论: 'practice',
  架构: 'server',
};
const CNCF_CATEGORY = { 概念: 'devops', 技术: 'devops', 属性: 'system', Concept: 'devops' };
let cncfAdded = 0;
for (const file of readdirSync(cncfZhDir).filter((name) => name.endsWith('.md') && !name.startsWith('_'))) {
  const parsed = parseFrontmatter(readFileSync(join(cncfZhDir, file), 'utf8'));
  let enTitle = '';
  try {
    enTitle = parseFrontmatter(readFileSync(join(cncfEnDir, file), 'utf8')).data.title || '';
  } catch {
    /* untranslated English title is optional */
  }
  const zh = parsed.data;
  let tags = [];
  if (typeof zh.tags === 'string') {
    try {
      tags = JSON.parse(zh.tags);
    } catch {
      tags = [];
    }
  } else if (Array.isArray(zh.tags)) {
    tags = zh.tags;
  }
  const tagCategory = tags.find((tag) => tag === '网络' || tag === '安全');
  const category = tagCategory ? CNCF_TAG_CATEGORY[tagCategory] : CNCF_CATEGORY[zh.category] || 'devops';
  const definition = stripComments(parsed.body)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .find((paragraph) => paragraph && !paragraph.startsWith('#') && !paragraph.startsWith('{{'));
  if (
    add({
      term: zh.title,
      full: enTitle,
      category,
      explanation: definition,
      source: 'cncf-glossary',
    })
  ) {
    cncfAdded += 1;
  }
}
sources.push({
  id: 'cncf-glossary',
  repo: 'https://github.com/cncf/glossary',
  path: 'content/zh-cn',
  license: 'Apache-2.0',
  commit: gitCommit(cncfDir),
  added: cncfAdded,
});

/* -------------------------------------------------------- ai-heihua-zh (MIT) */

const slangDir = join(sourcesDir, 'ai-heihua');
const slang = JSON.parse(readFileSync(join(slangDir, 'glossary/index.json'), 'utf8'));
const SLANG_CATEGORY = { ai: 'ai', cursor: 'ai', web: 'web', github: 'practice', cs: 'lang' };
let slangAdded = 0;
for (const item of slang.terms || []) {
  if (!item || !item.one) continue;
  if (item.cat === 'cs') continue;
  const category = SLANG_CATEGORY[item.cat] || 'practice';
  const parts = String(item.zh || '').split('/').map((part) => part.trim()).filter(Boolean);
  const term = parts[0] || item.en;
  const aliases = [item.en, ...parts.slice(1)];
  if (
    add({
      term,
      full: item.en || '',
      category,
      explanation: item.one,
      aliases,
      source: 'ai-heihua-zh',
    })
  ) {
    slangAdded += 1;
  }
}
sources.push({
  id: 'ai-heihua-zh',
  repo: 'https://github.com/YqqLikeGit/ai-heihua-zh',
  path: 'glossary/index.json',
  license: 'MIT',
  commit: gitCommit(slangDir),
  added: slangAdded,
});

/* ---------------------------------------------------------------- write file */

const output = {
  generatedBy: 'scripts/sync-external-glossary.mjs',
  note: 'Only permissive sources (Apache-2.0, MIT) are merged. Do not add NC/SA sources to the published package.',
  sources,
  entries: entries.map((row) => {
    const out = [row[0], row[1], row[2], row[3]];
    if (row[4] && Array.isArray(row[4].aliases) && row[4].aliases.length) out.push({ aliases: row[4].aliases });
    return out;
  }),
};
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data/external-glossary.json'), JSON.stringify(output, null, 2) + '\n');
console.log(
  'external glossary:',
  output.entries.length,
  'entries',
  sources.map((source) => `${source.id}:${source.added}`).join(' '),
);

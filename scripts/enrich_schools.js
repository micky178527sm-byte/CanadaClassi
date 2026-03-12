const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const jsonPath = path.join(ROOT, 'data', 'schools_mvp.json');
const dataJsPath = path.join(ROOT, 'data', 'schools_mvp.data.js');
const todoPath = path.join(ROOT, 'docs', 'schools_enrichment_TODO.md');

const noteLine = '料金・開始日・入学条件はコースや時期で変わることがあります。申込前に必ず最新条件を確認してください。';

function sanitize(text) {
  return String(text || '')
    .replace(/公式[^。]*。?/g, '')
    .replace(/最新[^。]*。?/g, '')
    .replace(/詳細[^。]*。?/g, '')
    .replace(/参照[^。]*。?/g, '')
    .replace(/確認[^。]*。?/g, '')
    .replace(/[()（）]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[。]+$/g, '')
    .trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function pickPrograms(programs) {
  const list = Array.isArray(programs) ? programs : [];
  const values = [];
  list.forEach((item) => {
    if (typeof item === 'string') {
      const v = sanitize(item);
      if (v) values.push(v);
      return;
    }
    const name = sanitize(item.name || '');
    const level = sanitize(item.level || '');
    const duration = sanitize(item.duration || '');
    const bits = [name, level, duration].filter(Boolean).join(' ');
    if (bits) values.push(bits);
  });
  return values;
}

function buildOverview(school) {
  const city = sanitize(school.city || '');
  const summaryLong = sanitize(school.summaryLong || '');
  const summary3 = toArray(school.summary3).map(sanitize).filter(Boolean);
  const highlights = toArray(school.highlights).map(sanitize).filter(Boolean);
  const programs = pickPrograms(school.programs);
  const support = toArray(school.support).map(sanitize).filter(Boolean);
  const areaInfo = sanitize(school.areaInfo || '');

  const leadParts = [];
  if (summaryLong) {
    const sentences = summaryLong.split('。').filter(Boolean).slice(0, 4);
    leadParts.push(...sentences.map((s) => `${s}。`));
  } else if (summary3.length) {
    leadParts.push(...summary3.slice(0, 3).map((s) => `${s.replace(/[。]+$/g, '')}。`));
  } else {
    const name = school.name || 'この学校';
    leadParts.push(`${name}は${city ? city + 'にある' : ''}学びの拠点です。`);
    leadParts.push('学べる内容や環境の特徴を整理すると判断しやすくなります。');
  }

  const canDo = [];
  if (programs.length) canDo.push(`学べる分野: ${programs.slice(0, 4).join('、')}`);
  if (highlights.length) canDo.push(`特徴: ${highlights.slice(0, 3).join('、')}`);
  if (support.length) canDo.push(`サポート: ${support.slice(0, 2).join('、')}`);

  const fit = [];
  const programText = programs.join(' ');
  if (/語学|英語|フランス語/.test(programText)) fit.push('語学学習を軸に選びたい人に合います');
  if (/ビジネス|IT|ヘルス|デザイン|メディア|観光/.test(programText)) fit.push('分野の選択肢を重視する人に合います');
  if (support.length) fit.push('サポートの有無を重視する人に合います');
  if (areaInfo || city) fit.push('通学や生活環境も含めて比較したい人に合います');

  const variable = [];
  if (school.tuitionNote) variable.push('費用は受講形態と期間で変わります');
  if (school.intakes) variable.push('開始日はコースやレベルで差が出ます');
  if (programs.length) variable.push('提供プログラムは時期で入替の可能性があります');
  if (!variable.length) variable.push('費用・開始日・提供内容は条件で変わる項目です');

  const blocks = [
    `<div class="cc-overview-block">${leadParts.map((t) => `<p class="cc-overview-lead">${t}</p>`).join('')}</div>`,
  ];
  if (canDo.length) {
    blocks.push(`
      <div class="cc-overview-block">
        <div class="cc-overview-h">できること</div>
        <ul class="cc-overview-list">${canDo.slice(0, 4).map((t) => `<li>${t}</li>`).join('')}</ul>
      </div>
    `);
  }
  if (fit.length) {
    blocks.push(`
      <div class="cc-overview-block">
        <div class="cc-overview-h">こんな人に合う</div>
        <ul class="cc-overview-list">${fit.slice(0, 4).map((t) => `<li>${t}</li>`).join('')}</ul>
      </div>
    `);
  }
  blocks.push(`
    <div class="cc-overview-block">
      <div class="cc-overview-h">変動しやすい項目</div>
      <ul class="cc-overview-list">${variable.slice(0, 3).map((t) => `<li>${t}</li>`).join('')}</ul>
    </div>
  `);
  return blocks.join('\n');
}

function deriveAccess(school) {
  if (school.access) return sanitize(school.access);
  if (school.areaInfo) {
    const first = String(school.areaInfo).split('。')[0].trim();
    return sanitize(first);
  }
  return '';
}

function normalizeSocialLinks(school) {
  const links = school.links && typeof school.links === 'object' ? school.links : {};
  const social = school.social && typeof school.social === 'object' ? school.social : {};
  const socialLinks = links.social && typeof links.social === 'object' ? links.social : {};
  return {
    instagram: socialLinks.instagram || social.instagram || links.instagram || school.instagram || '',
    facebook: socialLinks.facebook || social.facebook || links.facebook || school.facebook || '',
    youtube: socialLinks.youtube || social.youtube || links.youtube || school.youtube || '',
    tiktok: socialLinks.tiktok || social.tiktok || links.tiktok || school.tiktok || '',
    x: socialLinks.x || social.x || links.x || school.x || '',
    linkedin: socialLinks.linkedin || social.linkedin || links.linkedin || school.linkedin || ''
  };
}

function normalizeSchool(school) {
  const next = { ...school };
  next.address = sanitize(next.address || '');
  next.access = deriveAccess(next);
  next.summaryLong = sanitize(next.summaryLong || '');
  next.summary3 = toArray(next.summary3).map(sanitize).filter(Boolean);
  next.highlights = toArray(next.highlights).map(sanitize).filter(Boolean);
  next.support = toArray(next.support).map(sanitize).filter(Boolean);
  next.intakes = toArray(next.intakes).map(sanitize).filter(Boolean);
  next.tuitionNote = sanitize(next.tuitionNote || '');
  next.accreditation = toArray(next.accreditation).map(sanitize).filter(Boolean);
  next.areaInfo = sanitize(next.areaInfo || '');
  next.programsNote = sanitize(next.programsNote || '');

  const links = next.links && typeof next.links === 'object' ? { ...next.links } : {};
  links.officialSite = links.officialSite || next.officialSite || next.url || next.link || '';
  const social = normalizeSocialLinks(next);
  links.social = { ...(links.social || {}), ...social };
  next.links = links;

  next.overview = buildOverview(next);
  next.notes = noteLine;
  return next;
}

function buildTodo(schools) {
  const rows = schools.map((s) => {
    const missing = [];
    if (!s.links?.officialSite) missing.push('officialSite');
    if (!s.address) missing.push('address');
    if (!s.access) missing.push('access');
    const social = s.links?.social || {};
    const hasSocial = ['instagram', 'facebook', 'youtube', 'tiktok', 'x', 'linkedin'].some((k) => social[k]);
    if (!hasSocial) missing.push('social');
    if (!s.sources) missing.push('sources');
    const overviewShort = String(s.overview || '').replace(/<[^>]+>/g, '').trim().length < 80;
    if (overviewShort) missing.push('overview');
    return `| ${s.name || ''} | ${s.city || ''} | ${missing.join(', ') || 'OK'} |`;
  });

  return [
    '# Schools enrichment TODO',
    '',
    '| School | City | Missing |',
    '| --- | --- | --- |',
    ...rows,
    '',
    '## Suggested sources to collect',
    '- campus page (address, access)',
    '- contact page (phone/email)',
    '- socials page (Instagram/Facebook)',
    ''
  ].join('\n');
}

function main() {
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const list = JSON.parse(raw);
  const next = list.map(normalizeSchool);
  fs.writeFileSync(jsonPath, JSON.stringify(next, null, 2) + '\n');
  fs.writeFileSync(dataJsPath, `window.CC_SCHOOLS_MVP = ${JSON.stringify(next, null, 2)};\n`);
  fs.mkdirSync(path.dirname(todoPath), { recursive: true });
  fs.writeFileSync(todoPath, buildTodo(next));
}

main();

(function () {
  CodeMirror.defineSimpleMode('mud', {
    start: [
      { regex: /^---$/, token: 'header' },
      { regex: /^@@@$/, token: 'atom' },
      { regex: /^:::+\s*\S*/, token: 'keyword' },
      { regex: /^\s*[#]{1,6}\s+.*$/, token: 'strong' },
      { regex: /^\s*[-*+]\s+/, token: 'variable-2' },
      { regex: /\*\*[^*]+\*\*/, token: 'strong' },
      { regex: /`[^`]+`/, token: 'string' },
      { regex: /\[([^\]]+)\]\(([^)]+)\)/, token: 'link' },
    ],
    meta: { lineComment: '#' },
  });
})();

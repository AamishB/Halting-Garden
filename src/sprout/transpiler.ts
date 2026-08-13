export function transpilePythonToSprout(pythonCode: string): string {
  const lines = pythonCode.split('\n');
  const outLines: string[] = [];
  const indentStack: { indent: number, onExit?: string }[] = [{ indent: 0 }];
  const declaredVars = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    const trimmed = originalLine.trim();

    if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      outLines.push(originalLine.replace(/^(\s*)#/, '$1//'));
      continue;
    }

    const indentMatch = originalLine.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0].length : 0;
    const indentStr = ' '.repeat(indent);

    while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1].indent) {
      const top = indentStack.pop()!;
      if (top.onExit) {
        outLines.push(' '.repeat(top.indent) + top.onExit);
      }
      outLines.push(' '.repeat(top.indent - 4 > 0 ? top.indent - 4 : 0) + '}');
    }

    let pLine = trimmed;
    let pushesIndent = false;
    let onExitHook: string | undefined;

    if (pLine.startsWith('def ')) {
      pLine = pLine.replace(/^def\s+([a-zA-Z0-9_]+)\s*(\(.*?\))\s*:/, 'fn $1$2 {');
      pushesIndent = true;
    } else if (pLine.startsWith('class ')) {
      pLine = pLine.replace(/^class\s+([a-zA-Z0-9_]+)\s*:/, 'class $1 {');
      pushesIndent = true;
    } else if (pLine.startsWith('while ')) {
      pLine = pLine.replace(/^while\s+(.*?)\s*:/, 'while ($1) {');
      pushesIndent = true;
    } else if (pLine.startsWith('for ')) {
      const forMatch = pLine.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+range\((.*?)\)\s*:/);
      if (forMatch) {
        const varName = forMatch[1];
        const rangeEnd = forMatch[2];
        pLine = `var ${varName} = 0;\n${indentStr}while (${varName} < ${rangeEnd}) {`;
        pushesIndent = true;
        onExitHook = `${varName} = ${varName} + 1;`;
      }
    } else if (pLine.startsWith('if ')) {
      pLine = pLine.replace(/^if\s+(.*?)\s*:/, 'if ($1) {');
      pushesIndent = true;
    } else if (pLine.startsWith('elif ')) {
      pLine = pLine.replace(/^elif\s+(.*?)\s*:/, 'else if ($1) {');
      pushesIndent = true;
    } else if (pLine.startsWith('else:')) {
      pLine = pLine.replace(/^else\s*:/, 'else {');
      pushesIndent = true;
    } else if (pLine.startsWith('try:')) {
      pLine = pLine.replace(/^try\s*:/, 'try {');
      pushesIndent = true;
    } else if (pLine.startsWith('except:')) {
      pLine = pLine.replace(/^except\s*:/, 'catch {');
      pushesIndent = true;
    } else {
      const assignMatch = pLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)(.*)$/);
      if (assignMatch && !pLine.startsWith('return ') && !pLine.startsWith('var ') && !pLine.startsWith('this.')) {
        const varName = assignMatch[1];
        if (!declaredVars.has(varName)) {
          declaredVars.add(varName);
          pLine = `var ${pLine}`;
        }
      }
      if (!pLine.endsWith(';') && !pLine.endsWith('{') && !pLine.endsWith('}')) {
        pLine += ';';
      }
    }

    if (pLine.startsWith('else ') || pLine.startsWith('else {') || pLine.startsWith('catch {')) {
      const lastLine = outLines[outLines.length - 1];
      if (lastLine && lastLine.trim() === '}') {
        outLines[outLines.length - 1] = lastLine + ' ' + pLine;
      } else {
        outLines.push(indentStr + pLine);
      }
    } else {
      outLines.push(indentStr + pLine);
    }

    if (pushesIndent) {
      let nextIndent = indent + 4;
      for (let j = i + 1; j < lines.length; j++) {
        const nextTrim = lines[j].trim();
        if (nextTrim.length > 0 && !nextTrim.startsWith('#')) {
          const m = lines[j].match(/^\s*/);
          if (m && m[0].length > indent) {
            nextIndent = m[0].length;
          }
          break;
        }
      }
      indentStack.push({ indent: nextIndent, onExit: onExitHook });
    }
  }

  while (indentStack.length > 1) {
    const top = indentStack.pop()!;
    if (top.onExit) {
      outLines.push(' '.repeat(top.indent) + top.onExit);
    }
    outLines.push(' '.repeat(top.indent - 4 > 0 ? top.indent - 4 : 0) + '}');
  }

  return outLines.join('\n');
}

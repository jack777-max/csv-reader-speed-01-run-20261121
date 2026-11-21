// A faster drop-in for csv-reader 1.0.0: run(input) returns exactly csv-reader's answer for every input,
// {columns, rows, errors}, read by the same broken-row policy, but read in one pass of charCodeAt scans
// instead of one character at a time. A field whose characters need no rewriting (the common case) is cut
// out of the text with one slice; only a field that holds a dropped stray CR, a doubled quote or a CR
// inside its quotes is rebuilt, segment by segment, and only then. Errors are pushed in the order met,
// each {code, line, row} naming the record being read when it was met, exactly as the reference pushes them.

const COMMA_END = 0;
const BREAK_END = 1;
const EOF_END = 2;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1; // a U+FEFF at the very start is dropped

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and how many characters an unquoted read appended.
  let fVal = '';
  let fEnd = EOF_END;
  let fAdded = 0;

  // Reads unquoted characters from pos onto `prefix`, up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Sets fVal, fEnd, fAdded and leaves pos past the terminator.
  function readUnquoted(prefix) {
    const start = pos;
    let i = pos;
    let seg = pos; // the start of the clean run being scanned
    let parts = null; // the clean runs, once a stray CR has split the field
    let added = 0;
    for (;;) {
      if (i >= n) {
        pos = i;
        fEnd = EOF_END;
        break;
      }
      const c = text.charCodeAt(i);
      if (c === 44) { // ,
        pos = i + 1;
        fEnd = COMMA_END;
        break;
      }
      if (c === 10) { // LF
        pos = i + 1;
        line += 1;
        fEnd = BREAK_END;
        break;
      }
      if (c === 13) { // CR
        if (text.charCodeAt(i + 1) === 10) { // CRLF
          pos = i + 2;
          line += 1;
          fEnd = BREAK_END;
          break;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (parts === null) parts = [prefix];
        parts.push(text.slice(seg, i));
        added += i - seg;
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
    }
    if (parts !== null) {
      parts.push(text.slice(seg, i));
      fVal = parts.join('');
      fAdded = added + (i - seg);
    } else {
      fVal = prefix === '' ? text.slice(seg, i) : prefix + text.slice(seg, i);
      fAdded = i - start;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let i = pos + 1;
    let dirty = false; // the value needs rebuilding: a doubled quote or a CR inside the quotes
    let closed = false;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) { // "
        if (text.charCodeAt(i + 1) === 34) { // "" is one quote
          dirty = true;
          i += 2;
          continue;
        }
        closed = true;
        i += 1;
        break;
      }
      if (c === 13) { // CRLF and a lone CR inside quotes are each one LF
        dirty = true;
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        continue;
      }
      if (c === 10) line += 1;
      i += 1;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      readUnquoted('"');
      return;
    }
    const contentEnd = i - 1; // the closing quote
    let value;
    if (!dirty) {
      value = text.slice(open + 1, contentEnd);
    } else {
      const parts = [];
      let seg = open + 1;
      let j = open + 1;
      while (j < contentEnd) {
        const c = text.charCodeAt(j);
        if (c === 34) { // a doubled quote in the content
          parts.push(text.slice(seg, j), '"');
          j += 2;
          seg = j;
          continue;
        }
        if (c === 13) { // a CR in the content, read as one LF
          parts.push(text.slice(seg, j), '\n');
          j += text.charCodeAt(j + 1) === 10 ? 2 : 1;
          seg = j;
          continue;
        }
        j += 1;
      }
      parts.push(text.slice(seg, contentEnd));
      value = parts.join('');
    }
    pos = i;
    if (pos >= n) {
      fVal = value;
      fEnd = EOF_END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) { // ,
      pos += 1;
      fVal = value;
      fEnd = COMMA_END;
      return;
    }
    if (c === 10) { // LF
      pos += 1;
      line += 1;
      fVal = value;
      fEnd = BREAK_END;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) { // CRLF
      pos += 2;
      line += 1;
      fVal = value;
      fEnd = BREAK_END;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    for (;;) {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fVal);
      if (fEnd !== COMMA_END) break;
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

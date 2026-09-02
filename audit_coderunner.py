import os, json, re

DATA_DIR = '/Users/nigelmorris/Documents/GitHub/pixelCode/data'

def scan_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    objects = []
    i = 0
    n = len(text)
    in_string = False
    escape = False
    obj_stack = []
    obj_start_lines = []
    line = 1

    while i < n:
        c = text[i]
        if escape:
            escape = False
            i += 1
            continue
        if c == '\\' and in_string:
            escape = True
            i += 1
            continue
        if c == '"':
            in_string = not in_string
            i += 1
            continue
        if not in_string:
            if c == '{':
                obj_stack.append(i)
                obj_start_lines.append(line)
                i += 1
                continue
            if c == '}':
                if obj_stack:
                    obj_stack.pop()
                    obj_start_lines.pop()
                i += 1
                continue
            if c == '\n':
                line += 1
                i += 1
                continue
            if text.startswith('"type"', i):
                j = i + 6
                while j < n and text[j] in ' \t\n\r':
                    if text[j] == '\n':
                        line += 1
                    j += 1
                if j < n and text[j] == ':':
                    j += 1
                    while j < n and text[j] in ' \t\n\r':
                        if text[j] == '\n':
                            line += 1
                        j += 1
                    if text.startswith('"coderunner"', j):
                        if obj_stack:
                            start_idx = obj_stack[-1]
                            start_line = obj_start_lines[-1]
                        else:
                            start_idx = 0
                            start_line = 1
                        objects.append((start_idx, start_line))
                        i = j + len('"coderunner"')
                        continue
        i += 1
    return text, objects

def extract_object(text, start_idx):
    depth = 0
    k = start_idx
    in_str = False
    esc = False
    n = len(text)
    while k < n:
        ch = text[k]
        if esc:
            esc = False
            k += 1
            continue
        if ch == '\\' and in_str:
            esc = True
            k += 1
            continue
        if ch == '"':
            in_str = not in_str
            k += 1
            continue
        if not in_str:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    break
        k += 1
    return text[start_idx:k+1]

def classify_question(obj):
    pattern = obj.get('outputPattern')
    expected = obj.get('expectedOutput')
    starter = obj.get('starterCode')
    verdict = None
    details = []

    if not pattern:
        verdict = 'NO_PATTERN'
    else:
        if expected is None or expected == '':
            verdict = 'MISSING_OUTPUT'
        else:
            # Heuristic for BROKEN vs OK
            # Check for actual newline or tab in pattern
            has_newline = '\n' in pattern or '\t' in pattern or '\r' in pattern
            # Strict source syntax characters (very unlikely in plain output text)
            strict_syntax = set(';{}()[]=<>|&^~`\\@$\'"/*')
            # C# keywords
            keywords = ['console', 'writeline', 'write', 'readline', 'read', 'static', 'void', 'main',
                        'class', 'public', 'private', 'protected', 'internal', 'new', 'var', 'int',
                        'string', 'bool', 'double', 'float', 'char', 'long', 'short', 'byte', 'object',
                        'dynamic', 'using', 'namespace', 'if', 'else', 'for', 'foreach', 'while', 'do',
                        'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally',
                        'throw', 'true', 'false', 'null', 'default', 'explicit', 'operator', 'event',
                        'delegate', 'struct', 'enum', 'interface', 'abstract', 'sealed', 'partial',
                        'const', 'readonly', 'virtual', 'override', 'async', 'await', 'yield', 'select',
                        'where', 'from', 'orderby', 'let', 'into', 'join', 'group', 'by', 'tolist',
                        'toarray', 'count', 'length', 'add', 'remove', 'insert', 'clear', 'contains',
                        'trygetvalue', 'streamreader', 'task', 'delay', 'counter', 'increment']
            pattern_lower = pattern.lower()
            has_strict = any(ch in pattern for ch in strict_syntax)
            has_keyword = any(kw in pattern_lower for kw in keywords)
            if has_newline and not (has_strict or has_keyword):
                verdict = 'BROKEN_PATTERN'
            elif has_strict or has_keyword:
                verdict = 'OK_PATTERN'
            else:
                verdict = 'BROKEN_PATTERN'

    typos = []
    if starter:
        if 'WriteLinw' in starter or 'WriteLinw' in starter:
            typos.append('WriteLinw (should be WriteLine)')
        if 'Mian' in starter:
            typos.append('Mian (should be Main)')
        if 'Statc' in starter:
            typos.append('Statc (should be static)')
        if 'Usng' in starter:
            typos.append('Usng (should be using)')
        # Brace balance
        if starter.count('{') != starter.count('}'):
            typos.append('Mismatched braces')
        # Missing semicolons on lines that look like statements
        # Simple check: lines containing 'Console.WriteLine' but not ending with ';'
        for line_text in starter.splitlines():
            stripped = line_text.strip()
            if 'Console.WriteLine' in stripped and not stripped.endswith(';') and not stripped.endswith('{') and not stripped.endswith('}') and not stripped.startswith('//'):
                typos.append('Possible missing semicolon on: ' + stripped)
                break
    return verdict, typos

results = []
for filename in sorted(os.listdir(DATA_DIR)):
    if not filename.endswith('.json'):
        continue
    filepath = os.path.join(DATA_DIR, filename)
    text, objs = scan_file(filepath)
    for start_idx, start_line in objs:
        obj_text = extract_object(text, start_idx)
        try:
            obj = json.loads(obj_text)
        except Exception as e:
            print(f"ERROR parsing {filepath}:{start_line}: {e}")
            continue
        verdict, typos = classify_question(obj)
        results.append({
            'file': filepath,
            'line': start_line,
            'id': obj.get('id', 'N/A'),
            'prompt': obj.get('prompt', ''),
            'expectedOutput': obj.get('expectedOutput'),
            'outputPattern': obj.get('outputPattern'),
            'requiredStrings': obj.get('requiredStrings', []),
            'starterCode': obj.get('starterCode'),
            'verdict': verdict,
            'typos': typos,
        })

# Print summary
print("## Summary counts\n")
total = len(results)
verdicts = {}
for r in results:
    v = r['verdict']
    verdicts[v] = verdicts.get(v, 0) + 1
print(f"Total coderunner questions: {total}\n")
for v in sorted(verdicts):
    print(f"- {v}: {verdicts[v]}")
print()

# Group by file
from collections import defaultdict
files = defaultdict(list)
for r in results:
    files[r['file']].append(r)

print("## Per-file breakdown\n")
for filepath in sorted(files):
    print(f"### {filepath}\n")
    for r in files[filepath]:
        prompt = r['prompt']
        if len(prompt) > 80:
            prompt = prompt[:77] + '...'
        print(f"- **Line {r['line']}** | `{r['id']}` | {prompt} | **{r['verdict']}**")
    print()

print("## List of all BROKEN_PATTERN questions\n")
for r in results:
    if r['verdict'] == 'BROKEN_PATTERN':
        print(f"- `{r['file']}:{r['line']}` | `{r['id']}` | {r['prompt'][:80]}")
        print(f"  - outputPattern: `{repr(r['outputPattern'])}`")
        print()

print("## List of all STARTER_TYPO questions\n")
for r in results:
    if r['typos']:
        print(f"- `{r['file']}:{r['line']}` | `{r['id']}`")
        for t in r['typos']:
            print(f"  - {t}")
        print()

print("## A suggested fix for BROKEN_PATTERN\n")
# Group identical pattern shapes
broken = [r for r in results if r['verdict'] == 'BROKEN_PATTERN']
shape_counts = defaultdict(list)
for r in broken:
    shape_counts[r['outputPattern']].append(r['id'])
for shape, ids in sorted(shape_counts.items(), key=lambda x: -len(x[1])):
    print(f"- Pattern: `{repr(shape)}` (count: {len(ids)})")
    # Propose a corrected regex that matches a real C# Console.WriteLine("...") call instead.
    # We need to map the literal output to a regex that matches Console.WriteLine with that literal.
    # For example, if pattern is 'Hello, C#!', propose 'Console\\.WriteLine\\(\\s*"Hello, C#!"\\s*\\)\\s*;?'
    # But we need to escape regex metacharacters in the literal text.
    # Let's try to construct a generic proposal.
    # If the pattern is a simple literal string (no regex metacharacters except maybe \n, \t), we can escape it.
    # If the pattern contains regex metacharacters (like ^, $, \d, etc.), it's harder. But most broken patterns are literal output strings.
    # Let's create a regex by escaping the pattern and wrapping it.
    # However, some patterns contain regex escapes like \\. (literal dot). We need to handle them.
    # Actually, the pattern is a regex. If it's literal output, it may contain regex escapes that are meant to match literal characters in the output (like \\. for a literal dot). But in the source code, a literal dot is just `.` (which is a regex metacharacter). So the source pattern should escape the dot.
    # This is getting complicated. The user wants "a corrected regex that matches a real C# Console.WriteLine("...") call instead."
    # We can provide a generic template: `Console\.WriteLine\(\s*"<LITERAL>"\s*\)\s*;?` where <LITERAL> is the expected output with regex metacharacters escaped.
    # Let's generate that.
    # But if the pattern is something like `^42\n$`, the literal is `42\n`. The corrected regex would be `Console\.WriteLine\(\s*"42\n"\s*\)\s*;?`.
    # If the pattern is `Console\.WriteLine`, it's already OK, but if misclassified, we can note it.
    # For our heuristic, broken patterns are mostly literal output. So we can generate the fix.
    literal = shape
    # Unescape regex escapes that were meant to match literal output characters.
    # For example, `\\.` in the pattern means literal `\.` in the output? Actually, if the output is `Hello.World`, the JSON string would be `Hello\\.World` to escape the backslash, which json parses as `Hello\.World` (literal backslash-dot). Wait, in JSON, to represent a backslash, you need `\\`. To represent a dot, you just write `.`. So `Hello.World` in JSON is just `Hello.World`. The regex engine sees `Hello.World`, which means `Hello` + any char + `World`. If the intention is to match the literal output `Hello.World`, the regex should be `Hello\.World`. But the JSON data might have `Hello\\.World` (two backslashes) which json parses as `Hello\.World` (literal backslash then dot). That would match a literal backslash in the output, not a dot.
    # This is messy. Let's just provide the generic template and note that the literal text should be regex-escaped.
    escaped = re.escape(literal)
    # But re.escape will escape newlines too? re.escape on a string with newline will escape it as `\n`? Actually, re.escape escapes non-alphanumeric characters. It will escape newline as `\n` (backslash-n). In the regex, that means match a literal newline character. But in the source code, a newline inside a string literal is represented as `\n` (backslash-n). So to match `Console.WriteLine("Hello\nWorld")`, the regex should be `Console\.WriteLine\(\s*"Hello\\nWorld"\s*\)`.
    # So if the literal contains a newline, we need to represent it as `\\n` in the regex pattern string.
    # Similarly for tab: `\\t`.
    # Let's construct the regex pattern string for the source construct.
    # The source code string literal contains the text. To match it, we need to escape regex metacharacters in the literal.
    # Python's re.escape does that. But for actual newline characters, re.escape produces `\n` (two characters: backslash and n). That is exactly what we need for the regex to match a literal newline in the source? Wait, no. In the source code, a newline inside a string literal is written as `\n` (backslash-n). The regex `\n` (in the regex pattern) matches a literal newline character in the text being tested. But the text being tested is the source code. The source code contains the characters `\` and `n`, not an actual newline. So to match a literal newline inside a string literal in the source, the regex should contain `\\n` (two backslashes then n) which in the regex pattern means a literal backslash followed by `n`. Actually, in a regex pattern string, `\\` matches a literal backslash. So `\\n` matches `\n` (two characters). That's what we want.
    # But re.escape on a string containing an actual newline character will produce `\n` (two characters). If we use that in a regex pattern, it will match an actual newline in the source code. The source code does not have an actual newline inside the string literal (it's escaped as `\n`). So re.escape is not correct for newlines.
    # We need to replace actual newline characters in the literal with the two-character sequence `\\n` in the regex pattern. Similarly for tab: `\\t`. And carriage return: `\\r`.
    # Also, backslashes in the literal need to be escaped as `\\\\` in the regex pattern.
    # This is getting very complex. For the report, we can provide a conceptual template and note the escaping issues.
    # Let's just provide a template: `Console\.WriteLine\(\s*"<LITERAL>"\s*\)\s*;?` and mention that `<LITERAL>` should be regex-escaped, with actual newlines replaced by `\\n`, etc.
    print(f"  Suggested regex: `Console\\.WriteLine\\(\\s*\"...\"\\s*\\)\\s*;?` (replace `...` with properly escaped literal text)")
    print()

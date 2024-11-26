# Gramr

**Gramr** is a lightweight library for building **combinator-based parsers**. Whether you're parsing a string into tokens or transforming token streams into ASTs, Gramr makes it straightforward, efficient, and fun.

## 🌟 Features

- **Composable Parsers**: Build complex parsers by combining simple, reusable ones.
- **Tokenization Made Easy**: Define your grammar for tokenizing strings with intuitive combinators.
- **Flexible AST Generation**: Seamlessly convert token streams into Abstract Syntax Trees.
- **Lightweight**: Minimal overhead, zero dependency.
- **Typesafe**: Every rule is strictly type-annotated.

## 🚀 Installation

Install Gramr using your favorite package manager:

```bash
# npm
npm install gramr-ts

# yarn
yarn add gramr-ts
```

## ✨ Basic Usage

Here’s how you can get started:

### 1. Tokenize a String

```typescript
import { Lexer } from 'gramr-ts/lexer';
import { Rule } from 'gramr-ts/rule';

const tokenize = Lexer.create(
  [
    Lexer.anyOf('0123456789')
    .let(Rule.collect({ min: 1 }))
    .let(Lexer.slice)
    .let(
      Rule.map((value) => ({ type: 'number', value })),
    ),
    Lexer.exact('+').let(Rule.as({ type: 'plus' })),
  ],
  Lexer.whitespace.let(Rule.loop()),
);

const tokens = tokenize('3 + 5');
// Output: [{ type: 'number', value: '3' }, { type: 'plus' }, { type: 'number', value: '5' }]
console.log(tokens);
```

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
import { tokenizer } from 'gramr-ts/lex';



const tokenize = tokenizer([
  { name: 'NUMBER', regex: /\d+/ },
  { name: 'PLUS', regex: /\+/ },
  { name: 'WHITESPACE', regex: /\s+/, skip: true }, // Skip whitespace
]);

const tokens = tokenize('3 + 5');
// Output: [{ type: 'NUMBER', value: '3' }, { type: 'PLUS', value: '+' }, { type: 'NUMBER', value: '5' }]
console.log(tokens);

# Plugin API

A plugin must export `rules`:

```js
export const rules = [
  {
    id: 'custom.rule',
    defaultSeverity: 'warn',
    evaluate(skill, context) {
      return [];
    }
  }
];
```

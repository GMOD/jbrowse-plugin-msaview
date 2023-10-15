const fs = require('fs')
const r = fs.readFileSync('test2.tsv', 'utf8')
console.log(
  JSON.stringify(
    Object.fromEntries(
      r.split('\n').map(line => {
        const [genome, scientific, date, id, type, rest] = line.split('\t')
        return [id, { genome, scientific, date, id, type, rest }]
      }),
    ),
  ),
)

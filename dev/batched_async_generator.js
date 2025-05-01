let range1 = {
  from: 1,
  to: 5,

  async *[Symbol.asyncIterator]() {
    const promises = [];
    for (let value = this.from; value <= this.to; value++) {
      promises.push(
        new Promise(resolve => setTimeout(() => resolve(value), 100)) // Simulate async operation
      );
    }

    for (const result of await Promise.all(promises)) {
      yield result; // Yield each resolved value
    }
  }
};

let range2 = {
  from: 1,
  to: 5,

  async *[Symbol.asyncIterator]() {
    for (let value = this.from; value <= this.to; value++) {
      for await (const r of range1) {
        console.log('range2:', { r, value, from: this.from, to: this.to, ts: Date.now() });
        yield r; // Yield each result from range1 as it finishes
      }
      console.log('-----'); // Indicate the end of one batch
    }
  }
};

(async () => {
  for await (let value of range2) {
    console.log(value); // Outputs values from range1 as they finish
  }
})();
var redisStore = require('./dist/index');

var store = redisStore.create({
  host: '127.0.0.1',
  port: 6379,
  ttl: 712,
});

console.log(store.getClient().options);

store.set('lala', 'baba').then(() => store.get('lala').then((output) => {
  console.log(output);
  process.exit();
}));

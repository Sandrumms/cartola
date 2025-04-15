const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.use(middlewares);
server.use(router);
server.listen(3000, () => {
  console.log('JSON Server está rodando em http://localhost:3000');
});
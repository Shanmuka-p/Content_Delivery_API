import fastify from 'fastify';
import multipart from '@fastify/multipart';
import routes from './routes';

const server = fastify();

server.register(multipart);
server.register(routes);

server.listen({ port: 3000 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});

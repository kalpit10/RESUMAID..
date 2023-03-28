const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/result",
    createProxyMiddleware({
      target: "https://resumaid.herokuapp.com/",
      changeOrigin: true,
    })
  );
};

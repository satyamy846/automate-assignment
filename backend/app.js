const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const assetRoutes = require("./routes/assetRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const cookieParser = require("cookie-parser");
const swaggerDocs = require("./config/swagger");
const { attachSession, requireAuth } = require("./middlewares/sessionMiddleware");

class App {
  constructor() {
    this.app = express();
    this.middlewares();
    this.routes();
    this.swagger();
  }

  middlewares() {
    this.app.use(cors({
      origin: ["http://localhost:5173"], 
      credentials: true, // allow cookies
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }));
    this.app.use(express.json());


   this.app.use(cookieParser());
   this.app.use(attachSession);

  }

  routes() {
    this.app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    this.app.use("/api/v1/auth", authRoutes);
    this.app.use("/api/v1/assets", requireAuth,assetRoutes);
    this.app.use("/api/v1/analytics", analyticsRoutes);
  }

  swagger(){
    swaggerDocs(this.app);
  }
  getApp() {
    return this.app;
  }
}

module.exports = App;

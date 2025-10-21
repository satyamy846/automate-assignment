const express = require("express");
const AuthController = require("../controllers/authController");
const { verifySession } = require("../middlewares/sessionMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *  name: Auth
 *  description: User Authentication & Authorization
 */

/**
 * @swagger
 * /auth/signup:
 *  post:
 *      summary: Register a new user (email/password signup)
 *      tags: [Auth]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      required:
 *                          - name
 *                          - email
 *                          - password
 *                      properties:
 *                          name:
 *                              type: string
 *                              example: Satyam Kumar
 *                          email:
 *                              type: string
 *                              format: email
 *                              example: satyam@example.com
 *                          password:
 *                              type: string
 *                              format: password
 *                              example: password123
 *                          role:
 *                              type: string
 *                              enum: [admin, user, viewer]
 *                              default: user
 *                              example: user
 *      responses:
 *          201:
 *              description: User registered successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              status:
 *                                  type: string
 *                                  example: success
 *                              message:
 *                                  type: string
 *                                  example: User registered successfully
 *                              data:
 *                                  type: object
 *                                  properties:
 *                                      user:
 *                                          type: object
 *                                          properties:
 *                                              id:
 *                                                  type: integer
 *                                                  example: 1
 *                                              name:
 *                                                  type: string
 *                                                  example: Satyam Kumar
 *                                              email:
 *                                                  type: string
 *                                                  example: satyam@example.com
 *                                              role:
 *                                                  type: string
 *                                                  example: user
 *                                              created_at:
 *                                                  type: string
 *                                                  format: date-time
 *                                              updated_at:
 *                                                  type: string
 *                                                  format: date-time
 *          400:
 *              description: Missing required fields or user already exists
 *          500:
 *              description: Internal Server Error
 */
router.post("/signup", AuthController.signup);

/**
 * @swagger
 * /auth/login:
 *  post:
 *      summary: Login a user with email and password
 *      tags: [Auth]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      required:
 *                          - email
 *                          - password
 *                      properties:
 *                          email:
 *                              type: string
 *                              format: email
 *                              example: satyam@example.com
 *                          password:
 *                              type: string
 *                              format: password
 *                              example: password123
 *      responses:
 *          200:
 *              description: Login successful
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              status:
 *                                  type: string
 *                                  example: success
 *                              message:
 *                                  type: string
 *                                  example: Login successful
 *                              data:
 *                                  type: object
 *                                  properties:
 *                                      user:
 *                                          type: object
 *                                          properties:
 *                                              id:
 *                                                  type: integer
 *                                              name:
 *                                                  type: string
 *                                              email:
 *                                                  type: string
 *                                              role:
 *                                                  type: string
 *                                                  example: user
 *          400:
 *              description: Invalid email or password
 *          500:
 *              description: Internal Server Error
 */
router.post("/login", AuthController.login);

/**
 * @swagger
 * /auth/google-login:
 *   post:
 *     summary: Login or register a user using Google OAuth2
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Google ID token obtained from client-side sign-in
 *     responses:
 *       200:
 *         description: Google login successful
 *       400:
 *         description: Missing or invalid Google token
 *       500:
 *         description: Internal server error
 */
router.post("/google-login", AuthController.googleLogin);

/**
 * @swagger
 * /auth/logout:
 *  post:
 *      summary: Log out the current user
 *      tags: [Auth]
 *      responses:
 *          200:
 *              description: Logout successful
 *          400:
 *              description: No active session
 *          500:
 *              description: Internal Server Error
 */
router.post("/logout", AuthController.logout);

/**
 * @swagger
 * /auth/me:
 *  get:
 *      summary: Get current logged-in user details
 *      tags: [Auth]
 *      responses:
 *          200:
 *              description: Current user fetched successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              status:
 *                                  type: string
 *                                  example: success
 *                              message:
 *                                  type: string
 *                                  example: Current user fetched successfully
 *                              data:
 *                                  type: object
 *                                  properties:
 *                                      user:
 *                                          type: object
 *                                          properties:
 *                                              id:
 *                                                  type: integer
 *                                              name:
 *                                                  type: string
 *                                              email:
 *                                                  type: string
 *                                              role:
 *                                                  type: string
 *          401:
 *              description: Not logged in
 *          500:
 *              description: Internal Server Error
 */
router.get("/me", AuthController.getCurrentUser);

/**
 * @swagger
 * /auth/users/{id}:
 *   delete:
 *     summary: Delete a user by ID
 *     description: Deletes a specific user from the system. Only accessible to authenticated users (admin or self-deletion).
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Numeric ID of the user to delete
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *       401:
 *         description: Unauthorized — User not logged in or session invalid
 *       403:
 *         description: Forbidden — User does not have permission to delete this account
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal Server Error
 */
router.delete("/users/:id", verifySession, AuthController.deleteUser);

module.exports = router;

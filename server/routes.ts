import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertPostSchema, insertCommentSchema, insertLikeSchema, insertFriendSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Auth middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Admin middleware to check if user is an admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user?.id === 1) { // For simplicity, user with ID 1 is admin
    return next();
  }
  res.status(403).json({ message: "Forbidden: Admin access required" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);
  
  // Error handler for Zod validation errors
  const handleZodError = (error: unknown, res: Response) => {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  };
  
  // Post routes
  app.post("/api/posts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const postData = insertPostSchema.parse({ ...req.body, userId });
      
      const post = await storage.createPost(postData);
      res.status(201).json(post);
    } catch (error) {
      handleZodError(error, res);
    }
  });
  
  app.get("/api/posts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const posts = await storage.getPostsForFeed(userId);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });
  
  app.get("/api/posts/user/:userId", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const posts = await storage.getPostsByUser(userId);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user posts" });
    }
  });
  
  // Like routes
  app.post("/api/posts/:postId/like", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const postId = parseInt(req.params.postId);
      
      // Check if post exists
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Check if already liked
      const existingLike = await storage.getLike(userId, postId);
      if (existingLike) {
        return res.status(400).json({ message: "Post already liked" });
      }
      
      const likeData = insertLikeSchema.parse({ userId, postId });
      const like = await storage.createLike(likeData);
      
      // Get updated like count
      const likes = await storage.getLikesByPost(postId);
      
      res.status(201).json({ 
        like,
        count: likes.length
      });
    } catch (error) {
      handleZodError(error, res);
    }
  });
  
  app.delete("/api/posts/:postId/like", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const postId = parseInt(req.params.postId);
      
      // Check if post exists
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      await storage.removeLike(userId, postId);
      
      // Get updated like count
      const likes = await storage.getLikesByPost(postId);
      
      res.json({ 
        success: true,
        count: likes.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlike post" });
    }
  });
  
  // Comment routes
  app.post("/api/posts/:postId/comments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const postId = parseInt(req.params.postId);
      
      // Check if post exists
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const commentData = insertCommentSchema.parse({ 
        ...req.body, 
        userId, 
        postId 
      });
      
      const comment = await storage.createComment(commentData);
      
      // Include author with comment
      const author = await storage.getUser(userId);
      const commentWithAuthor = {
        ...comment,
        author: {
          ...author!,
          password: undefined
        }
      };
      
      res.status(201).json(commentWithAuthor);
    } catch (error) {
      handleZodError(error, res);
    }
  });
  
  app.get("/api/posts/:postId/comments", isAuthenticated, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      
      // Check if post exists
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const comments = await storage.getCommentsByPost(postId);
      
      // Include author with each comment
      const commentsWithAuthor = await Promise.all(comments.map(async comment => {
        const author = await storage.getUser(comment.userId);
        return {
          ...comment,
          author: {
            ...author!,
            password: undefined
          }
        };
      }));
      
      res.json(commentsWithAuthor);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });
  
  // Friend routes
  app.post("/api/friends/request", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const friendId = req.body.friendId;
      
      if (userId === friendId) {
        return res.status(400).json({ message: "Cannot send friend request to yourself" });
      }
      
      // Check if friend exists
      const friend = await storage.getUser(friendId);
      if (!friend) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if friend request already exists
      const existingRequest = await storage.getFriendRequest(userId, friendId);
      if (existingRequest) {
        return res.status(400).json({ message: "Friend request already exists" });
      }
      
      const friendData = insertFriendSchema.parse({ 
        userId, 
        friendId, 
        status: "pending" 
      });
      
      const friendRequest = await storage.createFriendRequest(friendData);
      res.status(201).json(friendRequest);
    } catch (error) {
      handleZodError(error, res);
    }
  });
  
  app.put("/api/friends/request/:requestId/accept", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      
      const updatedRequest = await storage.acceptFriendRequest(requestId);
      if (!updatedRequest) {
        return res.status(404).json({ message: "Friend request not found" });
      }
      
      res.json(updatedRequest);
    } catch (error) {
      res.status(500).json({ message: "Failed to accept friend request" });
    }
  });
  
  app.put("/api/friends/request/:requestId/reject", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      
      const updatedRequest = await storage.rejectFriendRequest(requestId);
      if (!updatedRequest) {
        return res.status(404).json({ message: "Friend request not found" });
      }
      
      res.json(updatedRequest);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject friend request" });
    }
  });
  
  app.get("/api/friends/requests", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      const requests = await storage.getFriendRequestsForUser(userId);
      
      // Remove password from user objects
      const safeRequests = requests.map(request => {
        return {
          ...request,
          user: {
            ...request.user,
            password: undefined
          }
        };
      });
      
      res.json(safeRequests);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });
  
  app.get("/api/friends", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      const friends = await storage.getFriends(userId);
      
      // Remove password from user objects
      const safeFriends = friends.map(friend => {
        return {
          ...friend,
          user: {
            ...friend.user,
            password: undefined
          }
        };
      });
      
      res.json(safeFriends);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });
  
  // User profile route
  app.get("/api/users/:userId", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const safeUser = {
        ...user,
        password: undefined
      };
      
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Remove passwords from response
      const safeUsers = users.map(user => ({
        ...user,
        password: undefined
      }));
      
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  app.get("/api/admin/posts", isAdmin, async (req, res) => {
    try {
      const posts = await storage.getAllPostsWithAuthors();
      
      // Remove passwords from authors
      const safePosts = posts.map(post => ({
        ...post,
        author: {
          ...post.author,
          password: undefined
        }
      }));
      
      res.json(safePosts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });
  
  app.delete("/api/admin/users/:userId", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Don't allow deleting the admin (user 1)
      if (userId === 1) {
        return res.status(400).json({ message: "Cannot delete admin user" });
      }
      
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  
  app.delete("/api/admin/posts/:postId", isAdmin, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      
      const success = await storage.deletePost(postId);
      if (!success) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete post" });
    }
  });
  
  app.put("/api/admin/users/:userId/ban", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Don't allow banning the admin (user 1)
      if (userId === 1) {
        return res.status(400).json({ message: "Cannot ban admin user" });
      }
      
      const updatedUser = await storage.toggleUserBanStatus(userId);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const safeUser = {
        ...updatedUser,
        password: undefined
      };
      
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle user ban status" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

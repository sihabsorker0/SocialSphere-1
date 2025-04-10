import { users, type User, type InsertUser, posts, type Post, type InsertPost, likes, type Like, type InsertLike, comments, type Comment, type InsertComment, friends, type Friend, type InsertFriend, type PostWithAuthor, type FriendWithUser } from "@shared/schema";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import createMemoryStore from "memorystore";
import session from "express-session";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Posts
  createPost(post: InsertPost): Promise<Post>;
  getPost(id: number): Promise<Post | undefined>;
  getPosts(): Promise<Post[]>;
  getPostsByUser(userId: number): Promise<Post[]>;
  getPostsForFeed(userId: number): Promise<PostWithAuthor[]>;
  getAllPostsWithAuthors(): Promise<(Post & { author: User })[]>;
  deletePost(id: number): Promise<boolean>;
  
  // Likes
  createLike(like: InsertLike): Promise<Like>;
  removeLike(userId: number, postId: number): Promise<void>;
  getLike(userId: number, postId: number): Promise<Like | undefined>;
  getLikesByPost(postId: number): Promise<Like[]>;
  
  // Comments
  createComment(comment: InsertComment): Promise<Comment>;
  getCommentsByPost(postId: number): Promise<Comment[]>;
  
  // Friends
  createFriendRequest(friend: InsertFriend): Promise<Friend>;
  acceptFriendRequest(id: number): Promise<Friend | undefined>;
  rejectFriendRequest(id: number): Promise<Friend | undefined>;
  getFriendRequest(userId: number, friendId: number): Promise<Friend | undefined>;
  getFriendRequestsForUser(userId: number): Promise<FriendWithUser[]>;
  getFriends(userId: number): Promise<FriendWithUser[]>;
  
  // Admin
  toggleUserBanStatus(userId: number): Promise<User | undefined>;
  
  // Session
  sessionStore: any; // Using any to avoid SessionStore type issues
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private posts: Map<number, Post>;
  private likes: Map<number, Like>;
  private comments: Map<number, Comment>;
  private friends: Map<number, Friend>;
  sessionStore: any; // Using any to avoid SessionStore type issues
  
  currentUserId: number;
  currentPostId: number;
  currentLikeId: number;
  currentCommentId: number;
  currentFriendId: number;

  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.likes = new Map();
    this.comments = new Map();
    this.friends = new Map();
    
    this.currentUserId = 1;
    this.currentPostId = 1;
    this.currentLikeId = 1;
    this.currentCommentId = 1;
    this.currentFriendId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // Clear expired sessions every 24h
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: now, 
      isBanned: false,
      bio: insertUser.bio ?? null,
      profileImage: insertUser.profileImage ?? null
    };
    this.users.set(id, user);
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }
  
  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user) return false;
    
    // Delete user
    this.users.delete(id);
    
    // Delete user's posts
    const userPosts = await this.getPostsByUser(id);
    for (const post of userPosts) {
      await this.deletePost(post.id);
    }
    
    // Delete user's likes
    const allLikes = Array.from(this.likes.values());
    for (const like of allLikes) {
      if (like.userId === id) {
        this.likes.delete(like.id);
      }
    }
    
    // Delete user's comments
    const allComments = Array.from(this.comments.values());
    for (const comment of allComments) {
      if (comment.userId === id) {
        this.comments.delete(comment.id);
      }
    }
    
    // Delete user's friend connections
    const allFriends = Array.from(this.friends.values());
    for (const friend of allFriends) {
      if (friend.userId === id || friend.friendId === id) {
        this.friends.delete(friend.id);
      }
    }
    
    return true;
  }
  
  // Post methods
  async createPost(insertPost: InsertPost): Promise<Post> {
    const id = this.currentPostId++;
    const now = new Date();
    const post: Post = { ...insertPost, id, createdAt: now };
    this.posts.set(id, post);
    return post;
  }
  
  async getPost(id: number): Promise<Post | undefined> {
    return this.posts.get(id);
  }
  
  async getPosts(): Promise<Post[]> {
    return Array.from(this.posts.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
  
  async getPostsByUser(userId: number): Promise<Post[]> {
    return Array.from(this.posts.values())
      .filter(post => post.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async getPostsForFeed(userId: number): Promise<PostWithAuthor[]> {
    // Get user's friends
    const userFriends = await this.getFriends(userId);
    const friendIds = userFriends.map(friend => 
      friend.userId === userId ? friend.friendId : friend.userId
    );
    
    // Include user's own posts in feed
    friendIds.push(userId);
    
    // Get posts from friends and user
    const feedPosts = Array.from(this.posts.values())
      .filter(post => friendIds.includes(post.userId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Enhance posts with author, likes, and comments
    const enhancedPosts = await Promise.all(feedPosts.map(async post => {
      const author = await this.getUser(post.userId);
      const postLikes = await this.getLikesByPost(post.id);
      const postComments = await this.getCommentsByPost(post.id);
      
      // Get user info for each comment
      const commentsWithAuthor = await Promise.all(postComments.map(async comment => {
        const commentAuthor = await this.getUser(comment.userId);
        return { ...comment, author: commentAuthor! };
      }));
      
      // Check if current user liked the post
      const userLike = await this.getLike(userId, post.id);
      
      return {
        ...post,
        author: author!,
        likes: postLikes.length,
        liked: !!userLike,
        comments: commentsWithAuthor
      };
    }));
    
    return enhancedPosts;
  }
  
  async getAllPostsWithAuthors(): Promise<(Post & { author: User })[]> {
    const allPosts = await this.getPosts();
    
    const postsWithAuthors = await Promise.all(allPosts.map(async post => {
      const author = await this.getUser(post.userId);
      const postLikes = await this.getLikesByPost(post.id);
      const postComments = await this.getCommentsByPost(post.id);
      
      return {
        ...post,
        author: author!,
        likesCount: postLikes.length,
        commentsCount: postComments.length
      };
    }));
    
    return postsWithAuthors;
  }
  
  async deletePost(id: number): Promise<boolean> {
    const post = await this.getPost(id);
    if (!post) return false;
    
    // Delete post
    this.posts.delete(id);
    
    // Delete post's likes
    const allLikes = Array.from(this.likes.values());
    for (const like of allLikes) {
      if (like.postId === id) {
        this.likes.delete(like.id);
      }
    }
    
    // Delete post's comments
    const allComments = Array.from(this.comments.values());
    for (const comment of allComments) {
      if (comment.postId === id) {
        this.comments.delete(comment.id);
      }
    }
    
    return true;
  }
  
  // Like methods
  async createLike(insertLike: InsertLike): Promise<Like> {
    const id = this.currentLikeId++;
    const now = new Date();
    const like: Like = { ...insertLike, id, createdAt: now };
    this.likes.set(id, like);
    return like;
  }
  
  async removeLike(userId: number, postId: number): Promise<void> {
    const like = await this.getLike(userId, postId);
    if (like) {
      this.likes.delete(like.id);
    }
  }
  
  async getLike(userId: number, postId: number): Promise<Like | undefined> {
    return Array.from(this.likes.values()).find(
      like => like.userId === userId && like.postId === postId
    );
  }
  
  async getLikesByPost(postId: number): Promise<Like[]> {
    return Array.from(this.likes.values()).filter(
      like => like.postId === postId
    );
  }
  
  // Comment methods
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = this.currentCommentId++;
    const now = new Date();
    const comment: Comment = { ...insertComment, id, createdAt: now };
    this.comments.set(id, comment);
    return comment;
  }
  
  async getCommentsByPost(postId: number): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.postId === postId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  
  // Friend methods
  async createFriendRequest(insertFriend: InsertFriend): Promise<Friend> {
    const id = this.currentFriendId++;
    const now = new Date();
    
    // Create the friend object with proper default for status
    const friend: Friend = { 
      ...insertFriend, 
      id, 
      createdAt: now,
      status: insertFriend.status ?? 'pending'  
    };
    
    this.friends.set(id, friend);
    return friend;
  }
  
  async acceptFriendRequest(id: number): Promise<Friend | undefined> {
    const friend = this.friends.get(id);
    if (friend) {
      const updatedFriend = { ...friend, status: 'accepted' };
      this.friends.set(id, updatedFriend);
      return updatedFriend;
    }
    return undefined;
  }
  
  async rejectFriendRequest(id: number): Promise<Friend | undefined> {
    const friend = this.friends.get(id);
    if (friend) {
      const updatedFriend = { ...friend, status: 'rejected' };
      this.friends.set(id, updatedFriend);
      return updatedFriend;
    }
    return undefined;
  }
  
  async getFriendRequest(userId: number, friendId: number): Promise<Friend | undefined> {
    return Array.from(this.friends.values()).find(
      friend => 
        (friend.userId === userId && friend.friendId === friendId) || 
        (friend.userId === friendId && friend.friendId === userId)
    );
  }
  
  async getFriendRequestsForUser(userId: number): Promise<FriendWithUser[]> {
    const requests = Array.from(this.friends.values()).filter(
      friend => friend.friendId === userId && friend.status === 'pending'
    );
    
    const requestsWithUser = await Promise.all(requests.map(async request => {
      const user = await this.getUser(request.userId);
      return { ...request, user: user! };
    }));
    
    return requestsWithUser;
  }
  
  async getFriends(userId: number): Promise<FriendWithUser[]> {
    // Get all accepted friend connections where user is either userId or friendId
    const friendConnections = Array.from(this.friends.values()).filter(
      friend => 
        (friend.status === 'accepted') &&
        ((friend.userId === userId) || (friend.friendId === userId))
    );
    
    const friendsWithUser = await Promise.all(friendConnections.map(async connection => {
      // If userId is the current user, get the friend user, otherwise get the requesting user
      const friendUserId = connection.userId === userId ? connection.friendId : connection.userId;
      const user = await this.getUser(friendUserId);
      return { ...connection, user: user! };
    }));
    
    return friendsWithUser;
  }
  
  // Admin methods
  async toggleUserBanStatus(userId: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    // Toggle ban status
    const updatedUser = { 
      ...user, 
      isBanned: !user.isBanned 
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
}

export const storage = new MemStorage();

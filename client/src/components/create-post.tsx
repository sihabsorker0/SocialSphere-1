import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Image, Smile, MapPin, Users } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export default function CreatePost() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/posts", { content });
      return await res.json();
    },
    onSuccess: () => {
      setContent("");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Post created",
        description: "Your post has been published",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({
        title: "Cannot create empty post",
        description: "Please write something to post",
        variant: "destructive",
      });
      return;
    }
    
    createPostMutation.mutate(content);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex space-x-2">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.profileImage} alt={user?.name} />
            <AvatarFallback>{user?.name ? getInitials(user.name) : "U"}</AvatarFallback>
          </Avatar>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start text-slate-500 bg-slate-50 hover:bg-slate-100"
              >
                What's on your mind, {user?.name?.split(" ")[0]}?
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-center text-xl">Create Post</DialogTitle>
              </DialogHeader>
              
              <div className="py-2">
                <div className="flex items-center space-x-2 mb-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.profileImage} alt={user?.name} />
                    <AvatarFallback>{user?.name ? getInitials(user.name) : "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user?.name}</div>
                    <div className="text-sm text-slate-500 flex items-center space-x-1">
                      <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-md">
                        <span className="i-earth">🌐</span>
                        <span>Public</span>
                      </span>
                    </div>
                  </div>
                </div>
                
                <Textarea
                  placeholder={`What's on your mind, ${user?.name?.split(" ")[0]}?`}
                  className="min-h-[150px] text-lg border-none shadow-none focus-visible:ring-0 p-0 resize-none placeholder:text-slate-400"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                
                <div className="rounded-lg border border-slate-200 p-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Add to your post</span>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" className="rounded-full text-green-500 hover:text-green-600 hover:bg-green-50">
                        <Image className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-blue-500 hover:text-blue-600 hover:bg-blue-50">
                        <Users className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50">
                        <Smile className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-red-500 hover:text-red-600 hover:bg-red-50">
                        <MapPin className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <DialogClose asChild>
                  <Button variant="ghost" className="mr-2">Cancel</Button>
                </DialogClose>
                <Button 
                  onClick={handleSubmit} 
                  disabled={createPostMutation.isPending || !content.trim()}
                  className="px-4"
                >
                  {createPostMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Post
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Separator className="my-4" />

        <div className="flex justify-between">
          <Button variant="ghost" className="flex-1 flex items-center justify-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M2 12a9.96 9.96 0 0 1 1.38-5.5c.28-.61.58-1.2.9-1.76"></path><path d="M6 4.5c-.53.5-1.04 1.05-1.5 1.63"></path><path d="M11.5 2h.5c1.76.0 3.94.58 5.87 1.62"></path><path d="M21.75 7a9.96 9.96 0 0 1 .2 9.5c-.28.61-.58 1.2-.9 1.76"></path><path d="M18 19.5c.53-.5 1.04-1.05 1.5-1.63"></path><path d="M12.5 22h-.5c-1.76.0-3.94-.58-5.87-1.62"></path><circle cx="12" cy="12" r="1"></circle><path d="M20.5 19.67a12 12 0 0 0-17.32.0"></path></svg>
            <span className="font-medium text-slate-600">Live Video</span>
          </Button>
          <Button variant="ghost" className="flex-1 flex items-center justify-center space-x-2">
            <Image className="text-green-500" />
            <span className="font-medium text-slate-600">Photo/Video</span>
          </Button>
          <Button variant="ghost" className="flex-1 flex items-center justify-center space-x-2">
            <Smile className="text-yellow-500" />
            <span className="font-medium text-slate-600">Feeling/Activity</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

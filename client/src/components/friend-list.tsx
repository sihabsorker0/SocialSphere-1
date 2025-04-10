import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FriendWithUser } from "@shared/schema";
import { Link } from "wouter";

export default function FriendList() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  
  // Get friends
  const friendsQuery = useQuery<FriendWithUser[], Error>({
    queryKey: ["/api/friends"],
    staleTime: 30000, // 30 seconds
  });
  
  // Get friend requests
  const requestsQuery = useQuery<FriendWithUser[], Error>({
    queryKey: ["/api/friends/requests"],
    staleTime: 30000, // 30 seconds
  });
  
  // Accept friend request mutation
  const acceptMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("PUT", `/api/friends/request/${requestId}/accept`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      toast({
        title: "Friend request accepted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept friend request",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Reject friend request mutation
  const rejectMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("PUT", `/api/friends/request/${requestId}/reject`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      toast({
        title: "Friend request rejected",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reject friend request",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Helper function to get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };
  
  // Loading states
  const isLoading = activeTab === 'friends' 
    ? friendsQuery.isLoading 
    : requestsQuery.isLoading;
  
  // Friends data
  const friends = friendsQuery.data || [];
  const requests = requestsQuery.data || [];
  
  const handleAccept = (requestId: number) => {
    acceptMutation.mutate(requestId);
  };
  
  const handleReject = (requestId: number) => {
    rejectMutation.mutate(requestId);
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Friends</CardTitle>
          {requests.length > 0 && (
            <div className="text-sm font-medium bg-red-500 text-white px-2 py-1 rounded-full">
              {requests.length}
            </div>
          )}
        </div>
        
        <div className="flex space-x-2 mt-2">
          <Button
            variant={activeTab === 'friends' ? "default" : "outline"}
            onClick={() => setActiveTab('friends')}
            size="sm"
          >
            Friends
          </Button>
          <Button
            variant={activeTab === 'requests' ? "default" : "outline"}
            onClick={() => setActiveTab('requests')}
            size="sm"
            className="relative"
          >
            Requests
            {requests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                {requests.length}
              </span>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : activeTab === 'friends' ? (
          <>
            {friends.length === 0 ? (
              <div className="text-center py-4 text-slate-500">
                You don't have any friends yet
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between">
                    <Link href={`/profile/${friend.user.id}`} className="flex items-center space-x-2 hover:underline">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={friend.user.profileImage} alt={friend.user.name} />
                        <AvatarFallback>{getInitials(friend.user.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{friend.user.name}</span>
                    </Link>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-xs text-slate-500">Online</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {requests.length === 0 ? (
              <div className="text-center py-4 text-slate-500">
                No pending friend requests
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between">
                    <Link href={`/profile/${request.user.id}`} className="flex items-center space-x-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.user.profileImage} alt={request.user.name} />
                        <AvatarFallback>{getInitials(request.user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium hover:underline">{request.user.name}</div>
                        <div className="text-sm text-slate-500">Wants to be your friend</div>
                      </div>
                    </Link>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => handleAccept(request.id)}
                        disabled={acceptMutation.isPending}
                      >
                        {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleReject(request.id)}
                        disabled={rejectMutation.isPending}
                      >
                        {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

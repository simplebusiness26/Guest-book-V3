import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import {supabase} from "../services/supabase";

const NotificationContext=createContext(null);

export function NotificationProvider({children}){
  const [userId,setUserId]=useState(null);
  const [unreadCount,setUnreadCount]=useState(0);

  const refreshUnread=useCallback(async(explicitUserId)=>{
    const targetUserId=explicitUserId || userId;

    if(!targetUserId){
      setUnreadCount(0);
      return 0;
    }

    const {count,error}=await supabase
      .from("notifications")
      .select("id",{count:"exact",head:true})
      .eq("recipient_user_id",targetUserId)
      .is("read_at",null);

    if(error){
      console.log("Notification count error",error);
      return unreadCount;
    }

    const nextCount=count || 0;
    setUnreadCount(nextCount);
    return nextCount;
  },[userId,unreadCount]);

  useEffect(()=>{
    let mounted=true;

    supabase.auth.getUser().then(({data})=>{
      if(mounted) setUserId(data?.user?.id || null);
    });

    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUserId(session?.user?.id || null);
    });

    return()=>{
      mounted=false;
      subscription?.unsubscribe();
    };
  },[]);

  useEffect(()=>{
    setUnreadCount(0);

    if(!userId) return;

    refreshUnread(userId);

    const channel=supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event:"*",
          schema:"public",
          table:"notifications",
          filter:`recipient_user_id=eq.${userId}`
        },
        ()=>refreshUnread(userId)
      )
      .subscribe();

    return()=>{
      supabase.removeChannel(channel);
    };
  },[userId,refreshUnread]);

  const value=useMemo(()=>(
    {userId,unreadCount,refreshUnread}
  ),[userId,unreadCount,refreshUnread]);

  return(
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(){
  const value=useContext(NotificationContext);

  if(!value){
    throw new Error("useNotifications must be used inside NotificationProvider");
  }

  return value;
}

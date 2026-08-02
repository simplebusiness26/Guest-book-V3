import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";

export default function FollowButton({profileId,onChanged,compact=false}){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [followId,setFollowId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);

  const load=useCallback(async()=>{
    if(!profileId){setLoading(false);return;}

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    if(!currentUser || currentUser.id===profileId){
      setFollowId(null);
      setLoading(false);
      return;
    }

    const {data,error}=await supabase
      .from("explorer_follows")
      .select("id")
      .eq("follower_id",currentUser.id)
      .eq("following_id",profileId)
      .maybeSingle();

    if(error) console.log(error);
    setFollowId(data?.id || null);
    setLoading(false);
  },[profileId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function toggleFollow(){
    if(working || !profileId) return;

    if(!user){
      router.push("/auth/login");
      return;
    }

    if(user.id===profileId) return;

    setWorking(true);

    if(followId){
      const {error}=await supabase
        .from("explorer_follows")
        .delete()
        .eq("id",followId)
        .eq("follower_id",user.id);

      if(error){
        showFeedback(error.message,"error","Could not unfollow");
        setWorking(false);
        return;
      }

      setFollowId(null);
      showFeedback("You are no longer following this Explorer.","success","Unfollowed");
    }else{
      const {data,error}=await supabase
        .from("explorer_follows")
        .insert({follower_id:user.id,following_id:profileId})
        .select("id")
        .single();

      if(error){
        const duplicate=String(error.code)==="23505";
        if(duplicate){
          await load();
        }else{
          showFeedback(error.message,"error","Could not follow");
          setWorking(false);
          return;
        }
      }else{
        setFollowId(data.id);
        showFeedback("Their reviews and Moments will appear in your feed.","success","Following");
      }
    }

    setWorking(false);
    if(onChanged) await onChanged();
  }

  if(user?.id===profileId) return null;

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={followId ? "Unfollow Explorer" : "Follow Explorer"}
      disabled={loading || working}
      style={[
        styles.button,
        compact && styles.compact,
        followId && styles.following,
        (loading || working) && styles.disabled
      ]}
      onPress={toggleFollow}
    >
      {(loading || working)
        ? <ActivityIndicator size="small" color="white"/>
        : <Text style={[styles.text,followId && styles.followingText]}>
            {!user ? "Log in to follow" : followId ? "Following" : "Follow"}
          </Text>
      }
    </Pressable>
  );
}

const styles=StyleSheet.create({
  button:{
    minWidth:118,
    minHeight:44,
    paddingHorizontal:20,
    paddingVertical:12,
    borderRadius:13,
    backgroundColor:"#3212b6",
    alignItems:"center",
    justifyContent:"center"
  },
  compact:{minWidth:92,minHeight:38,paddingHorizontal:14,paddingVertical:9,borderRadius:11},
  following:{backgroundColor:"#2b2b31",borderColor:"#64646d",borderWidth:1},
  disabled:{opacity:0.65},
  text:{color:"white",fontWeight:"900",fontSize:14},
  followingText:{color:"#ddddE5"}
});

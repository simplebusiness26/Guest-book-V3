import React,{useEffect,useState} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {useNotifications} from "../context/NotificationContext";

export default function Home(){
  const {unreadCount}=useNotifications();
  const [loggedIn,setLoggedIn]=useState(false);
  const [isAdmin,setIsAdmin]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    checkUser();

    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{
      checkUser();
    });

    return()=>subscription.unsubscribe();
  },[]);

  async function checkUser(){
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setLoggedIn(false);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoggedIn(true);

    const {data:profile,error}=await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id",user.id)
      .single();

    setIsAdmin(!error && !!profile?.is_admin);
    setLoading(false);
  }

  if(loading){
    return(
      <View style={styles.container}>
        <ActivityIndicator size="large" color="white"/>
      </View>
    );
  }

  return(
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Guestbook</Text>

        <Text style={styles.subtitle}>
          Discover places, stays and local{"\n"}experiences
        </Text>

        {loggedIn && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unreadCount
              ? `${unreadCount} unread notifications`
              : "Notifications"
            }
            style={styles.notificationsButton}
            onPress={()=>router.push("/notifications")}
          >
            <Text style={styles.buttonText}>🔔 Notifications</Text>

            {unreadCount>0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount>99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        <Pressable
          style={[styles.actionButton,styles.eventsButton]}
          onPress={()=>router.push("/events")}
        >
          <Text style={styles.buttonText}>🎉 Explore Events</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton,styles.mapButton]}
          onPress={()=>router.push("/map")}
        >
          <Text style={styles.buttonText}>🗺 Explore Map</Text>
        </Pressable>

        {loggedIn ? (
          <Pressable
            style={[styles.actionButton,styles.menuButton]}
            onPress={()=>router.push("/menu")}
          >
            <Text style={styles.buttonText}>☰ Open Menu</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.actionButton,styles.menuButton]}
              onPress={()=>router.push("/auth/login")}
            >
              <Text style={styles.buttonText}>Login</Text>
            </Pressable>

            <Pressable
              style={[styles.actionButton,styles.menuButton]}
              onPress={()=>router.push("/auth/signup")}
            >
              <Text style={styles.buttonText}>Create Account</Text>
            </Pressable>
          </>
        )}

        {isAdmin && (
          <Pressable
            style={[styles.actionButton,styles.adminButton]}
            onPress={()=>router.push("/admin/dashboard")}
          >
            <Text style={styles.buttonText}>⚙️ Admin Dashboard</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:"#1b1b1d",
    alignItems:"center",
    justifyContent:"center",
    paddingHorizontal:24
  },
  content:{
    width:"100%",
    maxWidth:620,
    alignItems:"center"
  },
  title:{
    color:"white",
    fontSize:58,
    lineHeight:66,
    fontWeight:"bold",
    marginBottom:22,
    textAlign:"center"
  },
  subtitle:{
    color:"white",
    fontSize:22,
    lineHeight:30,
    marginBottom:62,
    textAlign:"center"
  },
  notificationsButton:{
    width:"84%",
    minHeight:84,
    paddingHorizontal:20,
    paddingVertical:20,
    borderRadius:16,
    marginBottom:28,
    backgroundColor:"#2a2a2c",
    borderWidth:1,
    borderColor:"#555559",
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center"
  },
  notificationBadge:{
    minWidth:42,
    height:42,
    paddingHorizontal:9,
    borderRadius:21,
    backgroundColor:"#b40000",
    alignItems:"center",
    justifyContent:"center",
    marginLeft:14
  },
  notificationBadgeText:{
    color:"white",
    fontSize:18,
    fontWeight:"bold"
  },
  actionButton:{
    width:"84%",
    minHeight:84,
    paddingHorizontal:20,
    paddingVertical:20,
    borderRadius:16,
    alignItems:"center",
    justifyContent:"center",
    marginBottom:28
  },
  eventsButton:{
    backgroundColor:"#25009f"
  },
  mapButton:{
    backgroundColor:"#0929d4"
  },
  menuButton:{
    backgroundColor:"#050505"
  },
  adminButton:{
    backgroundColor:"#6600cc"
  },
  buttonText:{
    color:"white",
    textAlign:"center",
    fontWeight:"bold",
    fontSize:22
  }
});
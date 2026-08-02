import React,{useEffect,useState} from "react";
import {
  ScrollView,
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

  function openNotifications(){
    router.push(loggedIn ? "/notifications" : "/auth/login");
  }

  if(loading){
    return(
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white"/>
      </View>
    );
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Guestbook</Text>

        <Text style={styles.subtitle}>
          Discover places, stays and local{"\n"}experiences
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={loggedIn && unreadCount
            ? `${unreadCount} unread notifications`
            : "Notifications"
          }
          style={styles.notificationsButton}
          onPress={openNotifications}
        >
          <Text style={styles.buttonText}>🔔 Notifications</Text>

          {loggedIn && unreadCount>0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount>99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>

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

        <Pressable
          style={[styles.actionButton,styles.menuButton]}
          onPress={()=>router.push("/menu")}
        >
          <Text style={styles.buttonText}>☰ Open Menu</Text>
        </Pressable>

        {isAdmin && (
          <Pressable
            style={[styles.actionButton,styles.adminButton]}
            onPress={()=>router.push("/admin/dashboard")}
          >
            <Text style={styles.buttonText}>⚙️ Admin Dashboard</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{
    flex:1,
    backgroundColor:"#1b1b1d"
  },
  loadingContainer:{
    flex:1,
    backgroundColor:"#1b1b1d",
    alignItems:"center",
    justifyContent:"center"
  },
  container:{
    flexGrow:1,
    alignItems:"center",
    justifyContent:"center",
    paddingHorizontal:24,
    paddingTop:48,
    paddingBottom:48
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
    marginBottom:52,
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
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
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  return(
    <View style={styles.container}>
      {loggedIn && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unreadCount
            ? `${unreadCount} unread notifications`
            : "Notifications"
          }
          style={styles.notificationButton}
          onPress={()=>router.push("/notifications")}
        >
          <Text style={styles.notificationIcon}>🔔</Text>

          {unreadCount>0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount>99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      )}

      <Text style={styles.title}>Guestbook</Text>

      <Text style={styles.subtitle}>
        Discover places, stays and local experiences
      </Text>

      <Pressable
        style={styles.primaryButton}
        onPress={()=>router.push("/map")}
      >
        <Text style={styles.buttonText}>🗺 Explore Map</Text>
      </Pressable>

      {!loggedIn && (
        <>
          <Pressable style={styles.button} onPress={()=>router.push("/auth/login")}>
            <Text style={styles.buttonText}>Login</Text>
          </Pressable>

          <Pressable style={styles.button} onPress={()=>router.push("/auth/signup")}>
            <Text style={styles.buttonText}>Create Account</Text>
          </Pressable>
        </>
      )}

      {loggedIn && (
        <Pressable style={styles.button} onPress={()=>router.push("/menu")}>
          <Text style={styles.buttonText}>☰ Open Menu</Text>
        </Pressable>
      )}

      {isAdmin && (
        <Pressable style={styles.adminButton} onPress={()=>router.push("/admin/dashboard")}>
          <Text style={styles.buttonText}>⚙️ Admin Dashboard</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  container:{
    flex:1,
    justifyContent:"center",
    alignItems:"center",
    padding:25
  },
  notificationButton:{
    position:"absolute",
    top:24,
    right:22,
    width:52,
    height:52,
    borderRadius:26,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:"#2b2b2b",
    borderWidth:1,
    borderColor:"#4c4c4c",
    zIndex:20,
    elevation:8
  },
  notificationIcon:{fontSize:24},
  notificationBadge:{
    position:"absolute",
    top:-4,
    right:-5,
    minWidth:23,
    height:23,
    paddingHorizontal:5,
    borderRadius:12,
    backgroundColor:"#e03131",
    alignItems:"center",
    justifyContent:"center",
    borderWidth:2,
    borderColor:"#1d1d1d"
  },
  notificationBadgeText:{
    color:"white",
    fontSize:11,
    fontWeight:"bold"
  },
  title:{
    fontSize:42,
    fontWeight:"bold",
    marginBottom:10
  },
  subtitle:{
    fontSize:16,
    marginBottom:40,
    textAlign:"center"
  },
  button:{
    backgroundColor:"#222",
    width:"90%",
    padding:16,
    borderRadius:12,
    marginTop:15
  },
  primaryButton:{
    backgroundColor:"#0066ff",
    width:"90%",
    padding:16,
    borderRadius:12
  },
  adminButton:{
    backgroundColor:"#6600ff",
    width:"90%",
    padding:16,
    borderRadius:12,
    marginTop:15
  },
  buttonText:{
    color:"white",
    textAlign:"center",
    fontWeight:"bold",
    fontSize:16
  }
});
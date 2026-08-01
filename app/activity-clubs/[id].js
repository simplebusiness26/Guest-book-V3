import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";

function formatDate(value){
  if(!value) return "Date to be confirmed";
  return new Date(value).toLocaleString([],{
    weekday:"short",
    day:"numeric",
    month:"short",
    hour:"2-digit",
    minute:"2-digit"
  });
}

export default function ActivityClubProfile(){
  const {id}=useLocalSearchParams();
  const [club,setClub]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [announcements,setAnnouncements]=useState([]);
  const [reviews,setReviews]=useState([]);
  const [membership,setMembership]=useState(null);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");

  useFocusEffect(
    useCallback(()=>{
      if(id) loadPage();
    },[id])
  );

  async function loadPage(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    if(currentUser){
      const {data:profileRow}=await supabase
        .from("profiles")
        .select("full_name,account_type")
        .eq("id",currentUser.id)
        .single();
      setProfile(profileRow || null);
    }else{
      setProfile(null);
    }

    const {data:clubRow,error:clubError}=await supabase
      .from("activity_clubs")
      .select("*")
      .eq("id",id)
      .single();

    if(clubError){
      console.log(clubError);
      setError("This activity club could not be loaded.");
      setLoading(false);
      return;
    }

    setClub(clubRow);

    const [sessionResult,announcementResult,reviewResult]=await Promise.all([
      supabase
        .from("activity_sessions")
        .select("*")
        .eq("club_id",id)
        .gte("starts_at",new Date().toISOString())
        .order("starts_at",{ascending:true}),
      supabase
        .from("activity_announcements")
        .select("*")
        .eq("club_id",id)
        .order("created_at",{ascending:false}),
      supabase
        .from("activity_club_reviews")
        .select("*")
        .eq("club_id",id)
        .order("created_at",{ascending:false})
    ]);

    setSessions(sessionResult.data || []);
    setAnnouncements(announcementResult.data || []);
    setReviews(reviewResult.data || []);

    if(currentUser){
      const {data:membershipRow}=await supabase
        .from("activity_memberships")
        .select("*")
        .eq("club_id",id)
        .eq("user_id",currentUser.id)
        .maybeSingle();
      setMembership(membershipRow || null);
    }else{
      setMembership(null);
    }

    setLoading(false);
  }

  async function applyToJoin(){
    if(!user){
      router.push("/auth/login");
      return;
    }

    if(profile?.account_type!=="explorer"){
      Alert.alert("Explorer account required","Only explorer accounts apply to join activity clubs.");
      return;
    }

    setSubmitting(true);

    const {error:applyError}=await supabase
      .from("activity_memberships")
      .insert({
        club_id:id,
        user_id:user.id,
        applicant_name:profile?.full_name || "Explorer",
        application_note:"",
        status:"pending"
      });

    setSubmitting(false);

    if(applyError){
      console.log(applyError);
      Alert.alert("Application not sent",applyError.message);
      return;
    }

    Alert.alert("Application sent","The manager will review your request.");
    await loadPage();
  }

  const isManager=!!user && club?.manager_id===user.id;
  const isApproved=membership?.status==="approved";
  const canOpenBoard=isManager || isApproved;

  if(loading){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  if(error || !club){
    return(
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Club not found"}</Text>
      </View>
    );
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.category}>{club.category}</Text>
        <Text style={styles.title}>{club.name}</Text>
        <Text style={styles.location}>📍 {club.location}</Text>
        {!!club.address && <Text style={styles.address}>{club.address}</Text>}
        <Text style={styles.description}>{club.description}</Text>
        <Text style={styles.price}>
          {Number(club.price)>0 ? `£${Number(club.price).toFixed(2)} per session` : "Free to attend"}
        </Text>
      </View>

      {isManager && (
        <Pressable
          style={styles.managerButton}
          onPress={()=>router.push("/manager/dashboard")}
        >
          <Text style={styles.buttonText}>Open Manager Dashboard</Text>
        </Pressable>
      )}

      {!isManager && !membership && (
        <Pressable
          style={styles.primaryButton}
          onPress={applyToJoin}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? "Sending application..." : "Apply to Join"}
          </Text>
        </Pressable>
      )}

      {!isManager && membership?.status==="pending" && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Application pending</Text>
          <Text>The manager must approve you before the private message board unlocks.</Text>
        </View>
      )}

      {!isManager && membership?.status==="rejected" && (
        <View style={styles.rejectedBox}>
          <Text style={styles.pendingTitle}>Application not approved</Text>
          <Text>You can still view the public club profile and reviews.</Text>
        </View>
      )}

      {canOpenBoard && (
        <Pressable
          style={styles.boardButton}
          onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}
        >
          <Text style={styles.buttonText}>Open Members’ Message Board</Text>
        </Pressable>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming sessions</Text>
        {sessions.length===0 && <Text style={styles.emptyText}>No upcoming sessions yet.</Text>}
        {sessions.map(session=>(
          <View key={session.id} style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>{session.title}</Text>
            <Text>{formatDate(session.starts_at)}</Text>
            <Text style={styles.capacity}>Capacity: {session.capacity}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Club announcements</Text>
        {announcements.length===0 && <Text style={styles.emptyText}>No announcements yet.</Text>}
        {announcements.map(item=>(
          <View key={item.id} style={styles.publicCard}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardText}>{item.message}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        {reviews.length===0 && <Text style={styles.emptyText}>No reviews yet.</Text>}
        {reviews.map(review=>(
          <View key={review.id} style={styles.publicCard}>
            <Text style={styles.cardTitle}>
              {review.reviewer_name || "Explorer"} · {"⭐".repeat(review.rating)}
            </Text>
            <Text style={styles.cardText}>{review.comment || "No written comment"}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f6f8"},
  content:{padding:20,paddingBottom:50},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  errorText:{fontSize:18,textAlign:"center"},
  hero:{backgroundColor:"white",padding:20,borderRadius:16,borderWidth:1,borderColor:"#e1e1e1"},
  category:{color:"#5633a8",fontWeight:"bold",marginBottom:8},
  title:{fontSize:30,fontWeight:"bold"},
  location:{fontSize:16,marginTop:10},
  address:{color:"#666",marginTop:4},
  description:{lineHeight:23,color:"#333",marginTop:16},
  price:{fontWeight:"bold",fontSize:16,marginTop:16},
  primaryButton:{backgroundColor:"#275bd6",padding:16,borderRadius:12,marginTop:16},
  managerButton:{backgroundColor:"#222",padding:16,borderRadius:12,marginTop:16},
  boardButton:{backgroundColor:"#5633a8",padding:16,borderRadius:12,marginTop:16},
  buttonText:{color:"white",fontWeight:"bold",textAlign:"center"},
  pendingBox:{backgroundColor:"#fff4d6",padding:16,borderRadius:12,marginTop:16},
  rejectedBox:{backgroundColor:"#ffe7e7",padding:16,borderRadius:12,marginTop:16},
  pendingTitle:{fontWeight:"bold",fontSize:17,marginBottom:6},
  section:{marginTop:28},
  sectionTitle:{fontSize:22,fontWeight:"bold",marginBottom:12},
  emptyText:{color:"#666"},
  sessionCard:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#e1e1e1",marginBottom:10},
  sessionTitle:{fontWeight:"bold",fontSize:17,marginBottom:6},
  capacity:{color:"#666",marginTop:5},
  publicCard:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#e1e1e1",marginBottom:10},
  cardTitle:{fontWeight:"bold",fontSize:16},
  cardText:{lineHeight:21,marginTop:7,color:"#444"}
});

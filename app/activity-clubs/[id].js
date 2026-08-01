import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";

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

function formatSubmittedDate(value){
  if(!value) return "";
  return new Date(value).toLocaleString([],{
    day:"numeric",
    month:"short",
    hour:"2-digit",
    minute:"2-digit"
  });
}

export default function ActivityClubProfile(){
  const {id}=useLocalSearchParams();
  const {showFeedback}=useFeedback();
  const [club,setClub]=useState(null);
  const [stats,setStats]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [announcements,setAnnouncements]=useState([]);
  const [reviews,setReviews]=useState([]);
  const [membership,setMembership]=useState(null);
  const [applicationNote,setApplicationNote]=useState("");
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{if(id) loadPage();},[id]));

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
      setError("This activity club could not be loaded.");
      setLoading(false);
      return;
    }

    setClub(clubRow);

    const [sessionResult,announcementResult,reviewResult,statsResult]=await Promise.all([
      supabase.from("activity_sessions").select("*").eq("club_id",id).gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}),
      supabase.from("activity_announcements").select("*").eq("club_id",id).order("created_at",{ascending:false}),
      supabase.from("activity_club_reviews").select("*").eq("club_id",id).order("created_at",{ascending:false}),
      supabase.from("activity_club_stats").select("*").eq("club_id",id).maybeSingle()
    ]);

    setSessions(sessionResult.data || []);
    setAnnouncements(announcementResult.data || []);
    setReviews(reviewResult.data || []);
    setStats(statsResult.data || null);

    if(currentUser){
      const {data:membershipRow}=await supabase
        .from("activity_memberships")
        .select("*")
        .eq("club_id",id)
        .eq("user_id",currentUser.id)
        .maybeSingle();
      setMembership(membershipRow || null);
      setApplicationNote(membershipRow?.application_note || "");
    }else{
      setMembership(null);
      setApplicationNote("");
    }

    setLoading(false);
  }

  async function applyToJoin(){
    if(!user){
      router.push("/auth/login");
      return;
    }

    if(profile?.account_type!=="explorer"){
      Alert.alert("Explorer account required","Only explorer accounts can apply to join activity clubs.");
      return;
    }

    if((stats?.spaces_remaining ?? club?.member_limit ?? 0)<=0){
      Alert.alert("Club full","This Activity Club has reached its member limit.");
      return;
    }

    setSubmitting(true);
    const now=new Date().toISOString();
    let applyError=null;

    if(membership && ["rejected","left","removed"].includes(membership.status)){
      const result=await supabase
        .from("activity_memberships")
        .update({
          status:"pending",
          applicant_name:profile?.full_name || "Explorer",
          application_note:applicationNote.trim(),
          applied_at:now,
          decided_at:null,
          manager_note:""
        })
        .eq("id",membership.id);
      applyError=result.error;
    }else{
      const result=await supabase
        .from("activity_memberships")
        .insert({
          club_id:id,
          user_id:user.id,
          applicant_name:profile?.full_name || "Explorer",
          application_note:applicationNote.trim(),
          status:"pending"
        });
      applyError=result.error;
    }

    setSubmitting(false);

    if(applyError){
      showFeedback(applyError.message,"error","Application not sent");
      return;
    }

    showFeedback(`Your request to join ${club.name} was sent to the manager.`,"success","Join request sent");
    await loadPage();
  }

  const isManager=!!user && club?.manager_id===user.id;
  const isApproved=membership?.status==="approved";
  const canOpenBoard=isManager || isApproved;
  const canApply=!membership || ["rejected","left","removed"].includes(membership.status);
  const clubFull=(stats?.spaces_remaining ?? club?.member_limit ?? 0)<=0;

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large"/></View>;
  }

  if(error || !club){
    return <View style={styles.center}><Text style={styles.errorText}>{error || "Club not found"}</Text></View>;
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.category}>{club.category}</Text>
        <Text style={styles.title}>{club.name}</Text>
        <Text style={styles.location}>📍 {club.location || "Location"}</Text>
        {!!club.address && <Text style={styles.address}>{club.address}</Text>}
        <Text style={styles.description}>{club.description}</Text>
        <Text style={styles.price}>{Number(club.price)>0 ? `£${Number(club.price).toFixed(2)} per session` : "Free to attend"}</Text>
        <View style={styles.capacityBox}>
          <Text style={styles.capacityTitle}>{stats?.member_count || 0} approved members</Text>
          <Text style={styles.capacityText}>{stats?.spaces_remaining ?? club.member_limit} of {club.member_limit} spaces remaining</Text>
        </View>
      </View>

      {isManager && <Pressable style={styles.managerButton} onPress={()=>router.push("/manager/dashboard")}><Text style={styles.buttonText}>Open Manager Dashboard</Text></Pressable>}

      {!isManager && canApply && !clubFull && <View style={styles.applyBox}>
        <Text style={styles.applyTitle}>{membership ? "Apply again" : "Request to join"}</Text>
        <Text style={styles.applyText}>The manager must approve you before you can see or post on the private message board.</Text>
        <TextInput style={styles.noteInput} placeholder="Optional message to the manager" value={applicationNote} onChangeText={setApplicationNote} multiline maxLength={300}/>
        <Pressable style={styles.primaryButton} onPress={applyToJoin} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Sending application..." : "Send Join Request"}</Text>
        </Pressable>
      </View>}

      {!isManager && canApply && clubFull && <View style={styles.fullBox}><Text style={styles.pendingTitle}>Club currently full</Text><Text>The manager has reached the approved member limit.</Text></View>}

      {!isManager && membership?.status==="pending" && (
        <View style={styles.submittedBox}>
          <View style={styles.submittedHeader}>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>PENDING APPROVAL</Text>
            </View>
            <Text style={styles.submittedIcon}>✓</Text>
          </View>
          <Text style={styles.submittedTitle}>Application submitted</Text>
          <Text style={styles.submittedText}>
            Waiting for the club manager to approve your request. You’ll get access to the private message board once approved.
          </Text>
          {!!membership.applied_at && (
            <Text style={styles.submittedDate}>Sent {formatSubmittedDate(membership.applied_at)}</Text>
          )}
          {!!membership.application_note && (
            <View style={styles.submittedNoteBox}>
              <Text style={styles.submittedNoteLabel}>Your message</Text>
              <Text style={styles.submittedNoteText}>{membership.application_note}</Text>
            </View>
          )}
        </View>
      )}

      {!isManager && membership?.status==="approved" && (
        <View style={styles.approvedBox}>
          <View style={styles.approvedBadge}>
            <Text style={styles.approvedBadgeText}>MEMBERSHIP APPROVED</Text>
          </View>
          <Text style={styles.approvedTitle}>You’re a member</Text>
          <Text style={styles.approvedText}>Your private message-board access is now active.</Text>
        </View>
      )}

      {!isManager && membership?.status==="rejected" && <View style={styles.rejectedBox}><Text style={styles.pendingTitle}>Application not approved</Text><Text>You can still view the public club profile and can submit another request later.</Text></View>}
      {!isManager && membership?.status==="removed" && <View style={styles.rejectedBox}><Text style={styles.pendingTitle}>Membership ended</Text><Text>You no longer have private member access, but you can apply to join again.</Text></View>}
      {canOpenBoard && <Pressable style={styles.boardButton} onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}><Text style={styles.buttonText}>Open Members’ Message Board</Text></Pressable>}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming sessions</Text>
        {sessions.length===0 && <Text style={styles.emptyText}>No upcoming sessions yet.</Text>}
        {sessions.map(session=><View key={session.id} style={styles.sessionCard}><Text style={styles.sessionTitle}>{session.title}</Text><Text>{formatDate(session.starts_at)}</Text><Text style={styles.sessionCapacity}>Session capacity: {session.capacity}</Text></View>)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Club announcements</Text>
        {announcements.length===0 && <Text style={styles.emptyText}>No announcements yet.</Text>}
        {announcements.map(item=><View key={item.id} style={styles.publicCard}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardText}>{item.message}</Text></View>)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        {reviews.length===0 && <Text style={styles.emptyText}>No reviews yet.</Text>}
        {reviews.map(review=><View key={review.id} style={styles.publicCard}><Text style={styles.cardTitle}>{review.reviewer_name || "Explorer"} · {"⭐".repeat(review.rating)}</Text><Text style={styles.cardText}>{review.comment || "No written comment"}</Text></View>)}
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
  capacityBox:{backgroundColor:"#f0edff",padding:13,borderRadius:11,marginTop:15},
  capacityTitle:{fontWeight:"bold",color:"#5633a8"},
  capacityText:{marginTop:4,color:"#555"},
  applyBox:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#ddd",marginTop:16},
  applyTitle:{fontSize:19,fontWeight:"bold"},
  applyText:{color:"#555",lineHeight:20,marginTop:6},
  noteInput:{borderWidth:1,borderColor:"#ccc",borderRadius:10,padding:12,minHeight:75,textAlignVertical:"top",marginTop:12},
  primaryButton:{backgroundColor:"#275bd6",padding:16,borderRadius:12,marginTop:12},
  managerButton:{backgroundColor:"#222",padding:16,borderRadius:12,marginTop:16},
  boardButton:{backgroundColor:"#5633a8",padding:16,borderRadius:12,marginTop:16},
  buttonText:{color:"white",fontWeight:"bold",textAlign:"center"},
  submittedBox:{backgroundColor:"#fff8df",padding:18,borderRadius:14,marginTop:16,borderWidth:1,borderColor:"#e4c761"},
  submittedHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  pendingBadge:{backgroundColor:"#f2d56b",paddingHorizontal:10,paddingVertical:6,borderRadius:20},
  pendingBadgeText:{fontSize:11,fontWeight:"bold",color:"#674d00",letterSpacing:0.4},
  submittedIcon:{fontSize:24,fontWeight:"bold",color:"#9a7600"},
  submittedTitle:{fontSize:22,fontWeight:"bold",marginTop:14,color:"#2c2c2c"},
  submittedText:{fontSize:16,lineHeight:23,color:"#51471f",marginTop:8},
  submittedDate:{fontSize:12,color:"#75662c",marginTop:10,fontWeight:"600"},
  submittedNoteBox:{backgroundColor:"rgba(255,255,255,0.65)",padding:12,borderRadius:10,marginTop:13},
  submittedNoteLabel:{fontSize:12,fontWeight:"bold",color:"#75662c",textTransform:"uppercase"},
  submittedNoteText:{fontSize:15,lineHeight:21,color:"#3f3a27",marginTop:5},
  approvedBox:{backgroundColor:"#e8f7ed",padding:18,borderRadius:14,marginTop:16,borderWidth:1,borderColor:"#91c9a1"},
  approvedBadge:{alignSelf:"flex-start",backgroundColor:"#bfe6ca",paddingHorizontal:10,paddingVertical:6,borderRadius:20},
  approvedBadgeText:{fontSize:11,fontWeight:"bold",color:"#1f7135",letterSpacing:0.4},
  approvedTitle:{fontSize:22,fontWeight:"bold",marginTop:14,color:"#174d27"},
  approvedText:{fontSize:16,lineHeight:22,color:"#2e6540",marginTop:7},
  rejectedBox:{backgroundColor:"#ffe7e7",padding:16,borderRadius:12,marginTop:16},
  fullBox:{backgroundColor:"#ffe8e8",padding:16,borderRadius:12,marginTop:16},
  pendingTitle:{fontWeight:"bold",fontSize:17,marginBottom:6},
  section:{marginTop:28},
  sectionTitle:{fontSize:22,fontWeight:"bold",marginBottom:12},
  emptyText:{color:"#666"},
  sessionCard:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#e1e1e1",marginBottom:10},
  sessionTitle:{fontWeight:"bold",fontSize:17,marginBottom:6},
  sessionCapacity:{color:"#666",marginTop:5},
  publicCard:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#e1e1e1",marginBottom:10},
  cardTitle:{fontWeight:"bold",fontSize:16},
  cardText:{lineHeight:21,marginTop:7,color:"#444"}
});

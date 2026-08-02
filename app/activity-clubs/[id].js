import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Linking
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import FavouriteButton from "../../components/FavouriteButton";

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
  return new Date(value).toLocaleString([],{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
}

function reviewDate(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}

export default function ActivityClubProfile(){
  const params=useLocalSearchParams();
  const id=Array.isArray(params.id) ? params.id[0] : params.id;
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

    let profileRow=null;
    if(currentUser){
      const {data}=await supabase
        .from("profiles")
        .select("full_name,account_type")
        .eq("id",currentUser.id)
        .single();
      profileRow=data || null;
    }
    setProfile(profileRow);

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
      supabase.from("activity_club_reviews").select("*").eq("club_id",id).eq("moderation_status","published").order("created_at",{ascending:false}),
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
      setApplicationNote(membershipRow?.status==="pending" ? (membershipRow.application_note || "") : "");
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
      Alert.alert("Explorer account required","Only Explorer accounts can apply to join activity clubs.");
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

  function openReview(){
    if(!user){
      router.push("/auth/login");
      return;
    }
    if(profile?.account_type!=="explorer"){
      Alert.alert("Explorer account required","Only Explorer accounts can leave reviews and earn points.");
      return;
    }
    if(!membership || !["approved","left","removed"].includes(membership.status)){
      Alert.alert("Membership required","Only approved or former members can review this Activity Club.");
      return;
    }
    router.push(`/activity-clubs/review/${club.id}`);
  }

  const isManager=!!user && club?.manager_id===user.id;
  const isApproved=membership?.status==="approved";
  const canOpenBoard=isManager || isApproved;
  const canApply=!membership || ["rejected","left","removed"].includes(membership.status);
  const canReview=!isManager && !!membership && ["approved","left","removed"].includes(membership.status);
  const clubFull=(stats?.spaces_remaining ?? club?.member_limit ?? 0)<=0;
  const approvedMemberCount=stats?.member_count || 0;
  const average=reviews.length
    ? (reviews.reduce((sum,item)=>sum+Number(item.rating || 0),0)/reviews.length).toFixed(1)
    : null;

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large" color="#a58cff"/></View>;
  }

  if(error || !club){
    return <View style={styles.center}><Text style={styles.errorText}>{error || "Club not found"}</Text></View>;
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!!club.image_url && <Image source={{uri:club.image_url}} style={styles.heroImage}/>}

      <View style={styles.hero}>
        <Text style={styles.category}>{club.category}</Text>
        <Text style={styles.title}>{club.name}</Text>
        <Text style={styles.location}>📍 {club.location || "Location"}</Text>
        {!!club.address && <Text style={styles.address}>{club.address}</Text>}
        <Text style={styles.description}>{club.description}</Text>
        <Text style={styles.price}>{Number(club.price)>0 ? `£${Number(club.price).toFixed(2)} per session` : "Free to attend"}</Text>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{approvedMemberCount}</Text>
            <Text style={styles.statLabel}>{approvedMemberCount===1 ? "member" : "members"}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.spaces_remaining ?? club.member_limit}</Text>
            <Text style={styles.statLabel}>spaces left</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{average || "—"}</Text>
            <Text style={styles.statLabel}>review score</Text>
          </View>
        </View>

        <FavouriteButton
          targetType="activity_club"
          targetId={club.id}
          targetName={club.name}
          targetImageUrl={club.image_url}
        />
      </View>

      {isManager && <Pressable style={styles.managerButton} onPress={()=>router.push("/manager/dashboard")}><Text style={styles.buttonText}>Open Manager Dashboard</Text></Pressable>}

      {!isManager && canApply && !clubFull && (
        <View style={styles.applyBox}>
          <Text style={styles.applyTitle}>{membership ? "Apply again" : "Request to join"}</Text>
          <Text style={styles.applyText}>The manager must approve you before you can see or post on the private message board.</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Optional message to the manager"
            placeholderTextColor="#85858e"
            value={applicationNote}
            onChangeText={setApplicationNote}
            multiline
            maxLength={300}
          />
          <Pressable style={styles.primaryButton} onPress={applyToJoin} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? "Sending application..." : "Send Join Request"}</Text>
          </Pressable>
        </View>
      )}

      {!isManager && canApply && clubFull && <View style={styles.fullBox}><Text style={styles.pendingTitle}>Club currently full</Text><Text style={styles.mutedText}>The manager has reached the approved member limit.</Text></View>}

      {!isManager && membership?.status==="pending" && (
        <View style={styles.submittedBox}>
          <View style={styles.submittedHeader}>
            <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>PENDING APPROVAL</Text></View>
            <Text style={styles.submittedIcon}>✓</Text>
          </View>
          <Text style={styles.submittedTitle}>Application submitted</Text>
          <Text style={styles.submittedText}>Waiting for the club manager to approve your request. You’ll get access to the private message board once approved.</Text>
          {!!membership.applied_at && <Text style={styles.submittedDate}>Sent {formatSubmittedDate(membership.applied_at)}</Text>}
          {!!membership.application_note && <View style={styles.submittedNoteBox}><Text style={styles.submittedNoteLabel}>Your message</Text><Text style={styles.submittedNoteText}>{membership.application_note}</Text></View>}
        </View>
      )}

      {!isManager && membership?.status==="approved" && (
        <View style={styles.approvedBox}>
          <View style={styles.approvedBadge}><Text style={styles.approvedBadgeText}>MEMBERSHIP APPROVED</Text></View>
          <Text style={styles.approvedTitle}>You’re a member</Text>
          <Text style={styles.approvedText}>Your private message-board access is now active.</Text>
        </View>
      )}

      {!isManager && membership?.status==="rejected" && <View style={styles.rejectedBox}><Text style={styles.pendingTitle}>Application not approved</Text><Text style={styles.rejectedText}>You can still view the public club profile and submit another request later.</Text></View>}

      {!isManager && membership?.status==="removed" && (
        <View style={styles.endedBox}>
          <View style={styles.endedBadge}><Text style={styles.endedBadgeText}>🚪 MEMBERSHIP ENDED</Text></View>
          <Text style={styles.endedTitle}>Membership ended</Text>
          <Text style={styles.endedText}>The club manager has ended your membership. You no longer have access to the private message board, but you can apply again.</Text>
        </View>
      )}

      {canOpenBoard && <Pressable style={styles.boardButton} onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}><Text style={styles.buttonText}>Open Members’ Message Board</Text></Pressable>}
      {canReview && <Pressable style={styles.reviewButton} onPress={openReview}><Text style={styles.buttonText}>⭐ Leave an Activity Club Review</Text></Pressable>}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming sessions</Text>
        {sessions.length===0 && <Text style={styles.emptyText}>No upcoming sessions yet.</Text>}
        {sessions.map(session=><View key={session.id} style={styles.sessionCard}><Text style={styles.sessionTitle}>{session.title}</Text><Text style={styles.cardText}>{formatDate(session.starts_at)}</Text><Text style={styles.sessionCapacity}>Session capacity: {session.capacity}</Text></View>)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Club announcements</Text>
        {announcements.length===0 && <Text style={styles.emptyText}>No announcements yet.</Text>}
        {announcements.map(item=><View key={item.id} style={styles.publicCard}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardText}>{item.message}</Text></View>)}
      </View>

      <View style={styles.section}>
        <View style={styles.reviewHeading}><Text style={styles.sectionTitle}>Reviews</Text><Text style={styles.reviewCount}>{reviews.length}</Text></View>
        {reviews.length===0 && <Text style={styles.emptyText}>No reviews yet.</Text>}
        {reviews.map(review=>(
          <Pressable key={review.id} style={styles.publicCard} onPress={()=>router.push(`/profile/${review.user_id}`)}>
            <View style={styles.reviewTop}>
              <View style={{flex:1}}>
                <Text style={styles.cardTitle}>{review.reviewer_name || "Explorer"}</Text>
                <Text style={styles.reviewDate}>{reviewDate(review.created_at)}</Text>
              </View>
              <View style={styles.pointsBadge}><Text style={styles.pointsText}>+{review.points_awarded || 0}</Text></View>
            </View>
            <Text style={styles.stars}>{"★".repeat(review.rating)}<Text style={styles.emptyStars}>{"★".repeat(5-review.rating)}</Text></Text>
            {!!review.review_title && <Text style={styles.reviewTitle}>{review.review_title}</Text>}
            <Text style={styles.cardText}>{review.comment || "No written comment"}</Text>
            {!!review.verified_qr && <Text style={styles.verified}>✓ VERIFIED ON-SITE REVIEW</Text>}
            {!!review.photos?.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewPhotos}>
                {review.photos.filter(Boolean).slice(0,3).map((url,index)=><Image key={`${review.id}-${index}`} source={{uri:url}} style={styles.reviewPhoto}/>)}
              </ScrollView>
            )}
            {!!review.video_url && (
              <Pressable style={styles.videoButton} onPress={(eventPress)=>{eventPress?.stopPropagation?.();Linking.openURL(review.video_url);}}>
                <Text style={styles.videoIcon}>▶</Text><Text style={styles.videoText}>Play video review</Text>
              </Pressable>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:60},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center",padding:30},
  errorText:{fontSize:18,textAlign:"center",color:"white"},
  heroImage:{width:"100%",height:220,borderRadius:17,backgroundColor:"#303036",marginBottom:14},
  hero:{backgroundColor:"#222226",padding:19,borderRadius:16,borderWidth:1,borderColor:"#44444b"},
  category:{color:"#c8b5ff",fontWeight:"900",marginBottom:8},
  title:{fontSize:30,fontWeight:"900",color:"white"},
  location:{fontSize:16,marginTop:10,color:"white"},
  address:{color:"#aaaab2",marginTop:4},
  description:{lineHeight:23,color:"#c5c5cd",marginTop:16},
  price:{fontWeight:"900",fontSize:16,marginTop:16,color:"white"},
  statRow:{flexDirection:"row",gap:8,marginTop:15},
  statBox:{flex:1,backgroundColor:"#2d2938",padding:11,borderRadius:11,alignItems:"center"},
  statValue:{color:"white",fontSize:18,fontWeight:"900"},
  statLabel:{color:"#9d94ae",fontSize:10,fontWeight:"700",marginTop:3},
  applyBox:{backgroundColor:"#222226",padding:16,borderRadius:12,borderWidth:1,borderColor:"#44444b",marginTop:16},
  applyTitle:{fontSize:19,fontWeight:"900",color:"white"},
  applyText:{color:"#aaaab2",lineHeight:20,marginTop:6},
  noteInput:{borderWidth:1,borderColor:"#4c4c54",backgroundColor:"#29292e",color:"white",borderRadius:10,padding:12,minHeight:75,textAlignVertical:"top",marginTop:12},
  primaryButton:{backgroundColor:"#275bd6",padding:16,borderRadius:12,marginTop:12},
  managerButton:{backgroundColor:"#050505",padding:16,borderRadius:12,marginTop:16},
  boardButton:{backgroundColor:"#5633a8",padding:16,borderRadius:12,marginTop:16},
  reviewButton:{backgroundColor:"#3212b6",padding:16,borderRadius:12,marginTop:10},
  buttonText:{color:"white",fontWeight:"900",textAlign:"center"},
  submittedBox:{backgroundColor:"#3a3217",padding:18,borderRadius:14,marginTop:16,borderWidth:1,borderColor:"#766326"},
  submittedHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  pendingBadge:{backgroundColor:"#66520b",paddingHorizontal:10,paddingVertical:6,borderRadius:20},
  pendingBadgeText:{fontSize:11,fontWeight:"900",color:"#f1d87c",letterSpacing:0.4},
  submittedIcon:{fontSize:24,fontWeight:"900",color:"#e0bf4e"},
  submittedTitle:{fontSize:22,fontWeight:"900",marginTop:14,color:"white"},
  submittedText:{fontSize:16,lineHeight:23,color:"#d4c99f",marginTop:8},
  submittedDate:{fontSize:12,color:"#b7a66a",marginTop:10,fontWeight:"600"},
  submittedNoteBox:{backgroundColor:"#2e291c",padding:12,borderRadius:10,marginTop:13},
  submittedNoteLabel:{fontSize:12,fontWeight:"900",color:"#b7a66a",textTransform:"uppercase"},
  submittedNoteText:{fontSize:15,lineHeight:21,color:"#e1dcc8",marginTop:5},
  approvedBox:{backgroundColor:"#173923",padding:18,borderRadius:14,marginTop:16,borderWidth:1,borderColor:"#2b6a42"},
  approvedBadge:{alignSelf:"flex-start",backgroundColor:"#245837",paddingHorizontal:10,paddingVertical:6,borderRadius:20},
  approvedBadgeText:{fontSize:11,fontWeight:"900",color:"#91e6ae",letterSpacing:0.4},
  approvedTitle:{fontSize:22,fontWeight:"900",marginTop:14,color:"white"},
  approvedText:{fontSize:16,lineHeight:22,color:"#ace1bd",marginTop:7},
  rejectedBox:{backgroundColor:"#3b171b",padding:16,borderRadius:12,marginTop:16,borderWidth:1,borderColor:"#80353d"},
  rejectedText:{color:"#ffb6bd",lineHeight:21},
  endedBox:{backgroundColor:"#29292e",padding:16,borderRadius:12,marginTop:16,borderWidth:1,borderColor:"#56565e"},
  endedBadge:{alignSelf:"flex-start",backgroundColor:"#38383e",paddingHorizontal:10,paddingVertical:6,borderRadius:20,marginBottom:12},
  endedBadgeText:{fontSize:11,fontWeight:"900",color:"#c3c3cb",letterSpacing:0.4},
  endedTitle:{fontWeight:"900",fontSize:17,color:"white",marginBottom:6},
  endedText:{color:"#b5b5bd",lineHeight:21},
  fullBox:{backgroundColor:"#3b171b",padding:16,borderRadius:12,marginTop:16},
  pendingTitle:{fontWeight:"900",fontSize:17,marginBottom:6,color:"white"},
  mutedText:{color:"#aaaab2"},
  section:{marginTop:28},
  sectionTitle:{fontSize:22,fontWeight:"900",marginBottom:12,color:"white"},
  emptyText:{color:"#9999a2"},
  sessionCard:{backgroundColor:"#222226",padding:16,borderRadius:12,borderWidth:1,borderColor:"#414147",marginBottom:10},
  sessionTitle:{fontWeight:"900",fontSize:17,marginBottom:6,color:"white"},
  sessionCapacity:{color:"#92929b",marginTop:5},
  publicCard:{backgroundColor:"#222226",padding:16,borderRadius:12,borderWidth:1,borderColor:"#414147",marginBottom:10},
  cardTitle:{fontWeight:"900",fontSize:16,color:"white"},
  cardText:{lineHeight:21,marginTop:7,color:"#c2c2ca"},
  reviewHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  reviewCount:{color:"#bca9ff",fontWeight:"900",marginBottom:12},
  reviewTop:{flexDirection:"row",alignItems:"center"},
  reviewDate:{color:"#8f8f99",fontSize:11,marginTop:3},
  pointsBadge:{backgroundColor:"#332553",borderRadius:18,paddingHorizontal:10,paddingVertical:6},
  pointsText:{color:"#c6b2ff",fontWeight:"900",fontSize:12},
  stars:{color:"#f5c542",fontSize:17,marginTop:11},
  emptyStars:{color:"#55555e"},
  reviewTitle:{color:"white",fontWeight:"900",fontSize:17,marginTop:9},
  verified:{alignSelf:"flex-start",color:"#87dfa6",backgroundColor:"#173923",paddingHorizontal:9,paddingVertical:5,borderRadius:15,overflow:"hidden",fontSize:9,fontWeight:"900",marginTop:10},
  reviewPhotos:{paddingTop:12},
  reviewPhoto:{width:105,height:105,borderRadius:10,backgroundColor:"#333338",marginRight:8},
  videoButton:{backgroundColor:"#302547",borderColor:"#5d4787",borderWidth:1,borderRadius:10,padding:12,flexDirection:"row",alignItems:"center",marginTop:12},
  videoIcon:{color:"white",fontSize:18,marginRight:10},
  videoText:{color:"white",fontWeight:"900"}
});

import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {formatEventPrice,formatEventRange,normalizeExternalUrl} from "../../utils/events";
import FavouriteButton from "../../components/FavouriteButton";

function reviewDate(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}

export default function EventDetails(){
  const {id}=useLocalSearchParams();
  const eventId=Array.isArray(id) ? id[0] : id;
  const [event,setEvent]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(eventId) loadEvent();
  },[eventId]));

  async function loadEvent(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    let profileRow=null;
    if(currentUser){
      const {data}=await supabase
        .from("profiles")
        .select("account_type")
        .eq("id",currentUser.id)
        .single();
      profileRow=data || null;
    }
    setProfile(profileRow);

    const [eventResult,reviewResult]=await Promise.all([
      supabase.from("events").select("*").eq("id",eventId).single(),
      supabase.from("event_reviews").select("*").eq("event_id",eventId).eq("moderation_status","published").order("created_at",{ascending:false})
    ]);

    if(eventResult.error){
      console.log(eventResult.error);
      setError("This event could not be found or is no longer published.");
      setLoading(false);
      return;
    }

    setEvent(eventResult.data);
    setReviews(reviewResult.data || []);
    setLoading(false);
  }

  async function openBookingPage(){
    const url=normalizeExternalUrl(event?.booking_url);
    if(!url) return;

    try{
      const supported=await Linking.canOpenURL(url);
      if(!supported){
        Alert.alert("Link unavailable","This booking link cannot be opened on this device.");
        return;
      }
      await Linking.openURL(url);
    }catch{
      Alert.alert("Link unavailable","This booking link could not be opened.");
    }
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
    if(new Date(event.starts_at)>new Date()){
      Alert.alert("Reviews unlock later","You can review this event once it has started.");
      return;
    }
    router.push(`/events/review/${event.id}`);
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large" color="#a58cff"/></View>;
  }

  if(error || !event){
    return(
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Event not found"}</Text>
        <Pressable style={styles.backButton} onPress={()=>router.replace("/events")}>
          <Text style={styles.buttonText}>Browse Events</Text>
        </Pressable>
      </View>
    );
  }

  const isManager=!!user && event.manager_id===user.id;
  const eventStarted=new Date(event.starts_at)<=new Date();
  const average=reviews.length
    ? (reviews.reduce((sum,item)=>sum+Number(item.rating || 0),0)/reviews.length).toFixed(1)
    : null;

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!!event.image_url && <Image source={{uri:event.image_url}} style={styles.image}/>}

      <View style={styles.hero}>
        <View style={styles.badgeRow}>
          <Text style={styles.category}>{event.category}</Text>
          {isManager && <Text style={styles.status}>{event.status}</Text>}
        </View>

        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.date}>📅 {formatEventRange(event.starts_at,event.ends_at)}</Text>
        <Text style={styles.location}>📍 {event.location || "Location"}</Text>
        {!!event.address && <Text style={styles.address}>{event.address}</Text>}

        <View style={styles.factRow}>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>PRICE</Text>
            <Text style={styles.factValue}>{formatEventPrice(event.price)}</Text>
          </View>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>CAPACITY</Text>
            <Text style={styles.factValue}>{event.capacity || "Open"}</Text>
          </View>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>REVIEWS</Text>
            <Text style={styles.factValue}>{average ? `${average}/5` : "New"}</Text>
          </View>
        </View>

        <FavouriteButton
          targetType="event"
          targetId={event.id}
          targetName={event.name}
          targetImageUrl={event.image_url}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About this event</Text>
        <Text style={styles.description}>{event.description || "The organiser has not added a description yet."}</Text>
      </View>

      <View style={styles.actions}>
        {event.status==="published" && !!event.booking_url && (
          <Pressable style={styles.bookingButton} onPress={openBookingPage}>
            <Text style={styles.buttonText}>Open booking website</Text>
          </Pressable>
        )}

        {!isManager && (
          <Pressable style={[styles.reviewButton,!eventStarted && styles.lockedButton]} onPress={openReview}>
            <Text style={styles.buttonText}>{eventStarted ? "⭐ Leave an Event Review" : "🔒 Reviews unlock when the event starts"}</Text>
          </Pressable>
        )}
      </View>

      {isManager && (
        <View style={styles.managerBox}>
          <Text style={styles.managerTitle}>Manager controls</Text>
          <Text style={styles.managerText}>Edit this listing or print its QR code from your dashboard.</Text>
          <View style={styles.buttonRow}>
            <Pressable style={styles.editButton} onPress={()=>router.push(`/events/edit/${event.id}`)}>
              <Text style={styles.editButtonText}>Edit event</Text>
            </Pressable>
            <Pressable style={styles.dashboardButton} onPress={()=>router.push("/manager/dashboard")}>
              <Text style={styles.buttonText}>Dashboard</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.reviewHeading}>
          <Text style={styles.sectionTitle}>Event reviews</Text>
          <Text style={styles.reviewCount}>{reviews.length}</Text>
        </View>

        {reviews.length===0 ? (
          <Text style={styles.emptyText}>No event reviews yet.</Text>
        ) : reviews.map(review=>(
          <Pressable key={review.id} style={styles.reviewCard} onPress={()=>router.push(`/profile/${review.user_id}`)}>
            <View style={styles.reviewTop}>
              <View style={{flex:1}}>
                <Text style={styles.reviewer}>{review.reviewer_name || "Explorer"}</Text>
                <Text style={styles.reviewDate}>{reviewDate(review.created_at)}</Text>
              </View>
              <View style={styles.pointsBadge}><Text style={styles.pointsText}>+{review.points_awarded || 0}</Text></View>
            </View>

            <Text style={styles.stars}>{"★".repeat(review.rating)}<Text style={styles.emptyStars}>{"★".repeat(5-review.rating)}</Text></Text>
            {!!review.review_title && <Text style={styles.reviewTitle}>{review.review_title}</Text>}
            <Text style={styles.reviewText}>{review.comment || "No written comment"}</Text>

            {!!review.verified_qr && <Text style={styles.verified}>✓ VERIFIED ON-SITE REVIEW</Text>}

            {!!review.photos?.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewPhotos}>
                {review.photos.filter(Boolean).slice(0,3).map((url,index)=><Image key={`${review.id}-${index}`} source={{uri:url}} style={styles.reviewPhoto}/>)}
              </ScrollView>
            )}

            {!!review.video_url && (
              <Pressable style={styles.videoButton} onPress={(eventPress)=>{
                eventPress?.stopPropagation?.();
                Linking.openURL(review.video_url);
              }}>
                <Text style={styles.videoIcon}>▶</Text>
                <Text style={styles.videoText}>Play video review</Text>
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
  errorText:{fontSize:18,textAlign:"center",lineHeight:25,color:"white"},
  image:{width:"100%",height:230,borderRadius:18,backgroundColor:"#303036",marginBottom:16},
  hero:{backgroundColor:"#222226",padding:19,borderRadius:17,borderWidth:1,borderColor:"#44444b"},
  badgeRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  category:{color:"#c5b2ff",backgroundColor:"#332553",fontWeight:"bold",paddingHorizontal:10,paddingVertical:6,borderRadius:20,overflow:"hidden"},
  status:{textTransform:"capitalize",fontWeight:"bold",fontSize:12,color:"#aaaab2"},
  title:{fontSize:31,fontWeight:"900",marginTop:15,color:"white"},
  date:{fontSize:16,fontWeight:"600",lineHeight:23,marginTop:14,color:"#d4c9f0"},
  location:{fontSize:16,marginTop:10,color:"white"},
  address:{color:"#aaaab2",marginTop:4,lineHeight:20},
  factRow:{flexDirection:"row",gap:8,marginTop:18},
  fact:{flex:1,backgroundColor:"#2d2938",padding:11,borderRadius:11},
  factLabel:{fontSize:9,fontWeight:"bold",color:"#9f91b6",letterSpacing:0.5},
  factValue:{fontSize:15,fontWeight:"900",marginTop:5,color:"white"},
  section:{backgroundColor:"#222226",padding:18,borderRadius:15,borderWidth:1,borderColor:"#414147",marginTop:16},
  sectionTitle:{fontSize:21,fontWeight:"900",color:"white"},
  description:{fontSize:16,lineHeight:24,color:"#c2c2ca",marginTop:10},
  actions:{marginTop:16,gap:10},
  bookingButton:{backgroundColor:"#5633a8",padding:16,borderRadius:12},
  reviewButton:{backgroundColor:"#3212b6",padding:16,borderRadius:12},
  lockedButton:{backgroundColor:"#393940"},
  backButton:{backgroundColor:"#5633a8",paddingHorizontal:22,paddingVertical:14,borderRadius:11,marginTop:18},
  buttonText:{color:"white",fontWeight:"900",textAlign:"center"},
  managerBox:{backgroundColor:"#3a331c",padding:17,borderRadius:14,borderWidth:1,borderColor:"#766526",marginTop:16},
  managerTitle:{fontSize:19,fontWeight:"900",color:"white"},
  managerText:{color:"#c9be95",lineHeight:20,marginTop:5},
  buttonRow:{flexDirection:"row",gap:10,marginTop:14},
  editButton:{flex:1,backgroundColor:"#222226",borderWidth:1,borderColor:"#8a6ed1",padding:14,borderRadius:10},
  editButtonText:{color:"#c9b7fa",fontWeight:"900",textAlign:"center"},
  dashboardButton:{flex:1,backgroundColor:"#050505",padding:14,borderRadius:10},
  reviewHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  reviewCount:{color:"#bca9ff",fontWeight:"900"},
  emptyText:{color:"#9999a2"},
  reviewCard:{backgroundColor:"#29292e",borderColor:"#48484f",borderWidth:1,borderRadius:14,padding:15,marginBottom:11},
  reviewTop:{flexDirection:"row",alignItems:"center"},
  reviewer:{color:"white",fontWeight:"900",fontSize:16},
  reviewDate:{color:"#8f8f99",fontSize:11,marginTop:3},
  pointsBadge:{backgroundColor:"#332553",borderRadius:18,paddingHorizontal:10,paddingVertical:6},
  pointsText:{color:"#c6b2ff",fontWeight:"900",fontSize:12},
  stars:{color:"#f5c542",fontSize:17,marginTop:11},
  emptyStars:{color:"#55555e"},
  reviewTitle:{color:"white",fontWeight:"900",fontSize:17,marginTop:9},
  reviewText:{color:"#c3c3cb",lineHeight:21,marginTop:6},
  verified:{alignSelf:"flex-start",color:"#87dfa6",backgroundColor:"#173923",paddingHorizontal:9,paddingVertical:5,borderRadius:15,overflow:"hidden",fontSize:9,fontWeight:"900",marginTop:10},
  reviewPhotos:{paddingTop:12},
  reviewPhoto:{width:105,height:105,borderRadius:10,backgroundColor:"#333338",marginRight:8},
  videoButton:{backgroundColor:"#302547",borderColor:"#5d4787",borderWidth:1,borderRadius:10,padding:12,flexDirection:"row",alignItems:"center",marginTop:12},
  videoIcon:{color:"white",fontSize:18,marginRight:10},
  videoText:{color:"white",fontWeight:"900"}
});

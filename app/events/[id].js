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

export default function EventDetails(){
  const {id}=useLocalSearchParams();
  const [event,setEvent]=useState(null);
  const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(id) loadEvent();
  },[id]));

  async function loadEvent(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    const {data,error:eventError}=await supabase
      .from("events")
      .select("*")
      .eq("id",id)
      .single();

    if(eventError){
      console.log(eventError);
      setError("This event could not be found or is no longer published.");
      setLoading(false);
      return;
    }

    setEvent(data);
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

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large"/></View>;
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
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About this event</Text>
        <Text style={styles.description}>{event.description || "The organiser has not added a description yet."}</Text>
      </View>

      {event.status==="published" && !!event.booking_url && (
        <Pressable style={styles.bookingButton} onPress={openBookingPage}>
          <Text style={styles.buttonText}>Open booking website</Text>
        </Pressable>
      )}

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
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f6f8"},
  content:{padding:20,paddingBottom:50},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  errorText:{fontSize:18,textAlign:"center",lineHeight:25},
  image:{width:"100%",height:230,borderRadius:18,backgroundColor:"#ddd",marginBottom:16},
  hero:{backgroundColor:"white",padding:20,borderRadius:17,borderWidth:1,borderColor:"#e1e1e1"},
  badgeRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  category:{color:"#5633a8",backgroundColor:"#eae4ff",fontWeight:"bold",paddingHorizontal:10,paddingVertical:6,borderRadius:20,overflow:"hidden"},
  status:{textTransform:"capitalize",fontWeight:"bold",fontSize:12,color:"#555"},
  title:{fontSize:31,fontWeight:"bold",marginTop:15},
  date:{fontSize:16,fontWeight:"600",lineHeight:23,marginTop:14,color:"#3f3550"},
  location:{fontSize:16,marginTop:10},
  address:{color:"#666",marginTop:4,lineHeight:20},
  factRow:{flexDirection:"row",gap:12,marginTop:18},
  fact:{flex:1,backgroundColor:"#f2eff8",padding:13,borderRadius:11},
  factLabel:{fontSize:11,fontWeight:"bold",color:"#6a5a7e",letterSpacing:0.5},
  factValue:{fontSize:17,fontWeight:"bold",marginTop:5},
  section:{backgroundColor:"white",padding:20,borderRadius:15,borderWidth:1,borderColor:"#e1e1e1",marginTop:16},
  sectionTitle:{fontSize:21,fontWeight:"bold"},
  description:{fontSize:16,lineHeight:24,color:"#3f444a",marginTop:10},
  bookingButton:{backgroundColor:"#5633a8",padding:16,borderRadius:12,marginTop:16},
  backButton:{backgroundColor:"#5633a8",paddingHorizontal:22,paddingVertical:14,borderRadius:11,marginTop:18},
  buttonText:{color:"white",fontWeight:"bold",textAlign:"center"},
  managerBox:{backgroundColor:"#fff8df",padding:17,borderRadius:14,borderWidth:1,borderColor:"#e4c761",marginTop:16},
  managerTitle:{fontSize:19,fontWeight:"bold"},
  managerText:{color:"#5e5535",lineHeight:20,marginTop:5},
  buttonRow:{flexDirection:"row",gap:10,marginTop:14},
  editButton:{flex:1,backgroundColor:"white",borderWidth:1,borderColor:"#5633a8",padding:14,borderRadius:10},
  editButtonText:{color:"#5633a8",fontWeight:"bold",textAlign:"center"},
  dashboardButton:{flex:1,backgroundColor:"#222",padding:14,borderRadius:10}
});

import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView
} from "react-native";
import {useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../../services/supabase";
import QRCodeGenerator from "../../../../components/QRCodeGenerator";

const LISTING_CONFIG={
  business:{table:"businesses",ownerColumn:"owner_id",nameColumn:"name",label:"Business"},
  property:{table:"properties",ownerColumn:"owner_id",nameColumn:"name",label:"Property"},
  activity:{table:"activity_clubs",ownerColumn:"manager_id",nameColumn:"name",label:"Activity Club"},
  event:{table:"events",ownerColumn:"manager_id",nameColumn:"name",label:"Event"}
};

export default function PrintableListingQR(){
  const {type,id}=useLocalSearchParams();
  const [listing,setListing]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(
    useCallback(()=>{
      if(type && id) loadListing();
    },[type,id])
  );

  async function loadListing(){
    setLoading(true);
    setError("");

    const config=LISTING_CONFIG[type];
    if(!config){
      setError("Unsupported listing type.");
      setLoading(false);
      return;
    }

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setError("Please log in to print this QR code.");
      setLoading(false);
      return;
    }

    const {data,error:listingError}=await supabase
      .from(config.table)
      .select("*")
      .eq("id",id)
      .eq(config.ownerColumn,user.id)
      .single();

    if(listingError){
      console.log(listingError);
      setError("This listing could not be loaded or is not owned by your account.");
      setLoading(false);
      return;
    }

    setListing({...data,_label:config.label,_name:data[config.nameColumn]});
    setLoading(false);
  }

  function printPage(){
    if(Platform.OS==="web" && typeof window!=="undefined"){
      window.print();
    }
  }

  if(loading){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  if(error || !listing){
    return(
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Listing not found"}</Text>
      </View>
    );
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.printCard}>
        <Text style={styles.brand}>Guestbook</Text>
        <Text style={styles.title}>{listing._name}</Text>
        <Text style={styles.subtitle}>Scan to view this {listing._label.toLowerCase()} on Guestbook</Text>

        <View style={styles.qrWrap}>
          <QRCodeGenerator
            businessId={type==="business" ? id : undefined}
            propertyId={type==="property" ? id : undefined}
            activityClubId={type==="activity" ? id : undefined}
            eventId={type==="event" ? id : undefined}
            size={260}
          />
        </View>

        <Text style={styles.footer}>Discover local places, activities and experiences.</Text>
      </View>

      {Platform.OS==="web" ? (
        <Pressable style={styles.printButton} onPress={printPage}>
          <Text style={styles.printButtonText}>Print QR Code</Text>
        </Pressable>
      ) : (
        <View style={styles.notice}>
          <Text>Open this page in the web preview to use your browser’s print option.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#eef1f6"},
  content:{padding:20,paddingBottom:50,alignItems:"center"},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  error:{fontSize:17,textAlign:"center"},
  printCard:{width:"100%",maxWidth:520,backgroundColor:"white",padding:28,borderRadius:18,alignItems:"center",borderWidth:1,borderColor:"#ddd"},
  brand:{fontSize:22,fontWeight:"bold",color:"#5633a8"},
  title:{fontSize:28,fontWeight:"bold",textAlign:"center",marginTop:12},
  subtitle:{fontSize:16,color:"#555",textAlign:"center",lineHeight:22,marginTop:8},
  qrWrap:{padding:22,backgroundColor:"white",marginTop:20},
  footer:{fontSize:13,color:"#666",textAlign:"center",marginTop:12},
  printButton:{width:"100%",maxWidth:520,backgroundColor:"#222",padding:16,borderRadius:12,marginTop:16},
  printButtonText:{color:"white",fontWeight:"bold",textAlign:"center"},
  notice:{width:"100%",maxWidth:520,backgroundColor:"#fff4d6",padding:16,borderRadius:12,marginTop:16}
});

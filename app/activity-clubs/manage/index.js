import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../../services/supabase";

export default function ManageActivityClubs(){
  const [loading,setLoading]=useState(true);
  const [status,setStatus]=useState(null);
  const [clubs,setClubs]=useState([]);
  const [error,setError]=useState("");

  useFocusEffect(
    useCallback(()=>{
      loadDashboard();
    },[])
  );

  async function loadDashboard(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      router.replace("/auth/login");
      return;
    }

    const {data:profile}=await supabase
      .from("profiles")
      .select("account_type")
      .eq("id",user.id)
      .single();

    if(profile?.account_type!=="manager"){
      setError("A manager account is required.");
      setLoading(false);
      return;
    }

    const [{data:capability,error:capabilityError},{data:clubRows,error:clubError}]=await Promise.all([
      supabase
        .from("manager_capabilities")
        .select("activity_clubs_status,activity_clubs_started_at,activity_clubs_ends_at")
        .eq("user_id",user.id)
        .maybeSingle(),
      supabase
        .from("activity_clubs")
        .select("*")
        .eq("manager_id",user.id)
        .order("created_at",{ascending:false})
    ]);

    if(capabilityError || clubError){
      console.log(capabilityError || clubError);
      setError("Activity Clubs have not been set up in Supabase yet.");
      setLoading(false);
      return;
    }

    setStatus(capability?.activity_clubs_status || "inactive");
    setClubs(clubRows || []);
    setLoading(false);
  }

  const enabled=status==="active" || status==="trial";

  if(loading){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Manage Activity Clubs</Text>
      <Text style={styles.subtitle}>
        Review applications, manage members and open the private club message board.
      </Text>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Setup required</Text>
          <Text>{error}</Text>
        </View>
      )}

      {!error && (
        <View style={[styles.capabilityBox,enabled ? styles.enabledBox : styles.disabledBox]}>
          <Text style={styles.capabilityTitle}>Activity Clubs add-on</Text>
          <Text style={styles.capabilityStatus}>{status || "inactive"}</Text>
          {!enabled && (
            <Text style={styles.capabilityText}>
              This manager account does not currently have access. Payments will control this later.
            </Text>
          )}
        </View>
      )}

      {!error && enabled && clubs.length===0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No Activity Clubs yet</Text>
          <Text>The test club will appear after the Supabase seed SQL has been run.</Text>
        </View>
      )}

      {!error && enabled && clubs.map(club=>(
        <Pressable
          key={club.id}
          style={styles.card}
          onPress={()=>router.push(`/activity-clubs/manage/${club.id}`)}
        >
          <Text style={styles.clubName}>{club.name}</Text>
          <Text style={styles.meta}>{club.category} · {club.location}</Text>
          <Text style={styles.statusText}>Status: {club.status}</Text>
          <Text style={styles.openText}>Open manager controls →</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f6f8"},
  content:{padding:20,paddingBottom:50},
  center:{flex:1,alignItems:"center",justifyContent:"center"},
  title:{fontSize:30,fontWeight:"bold"},
  subtitle:{color:"#555",lineHeight:22,marginTop:8,marginBottom:18},
  errorBox:{backgroundColor:"#ffe7e7",padding:18,borderRadius:14},
  errorTitle:{fontWeight:"bold",fontSize:18,marginBottom:6},
  capabilityBox:{padding:18,borderRadius:14,borderWidth:1,marginBottom:18},
  enabledBox:{backgroundColor:"#e7f7ec",borderColor:"#9ed2ad"},
  disabledBox:{backgroundColor:"#fff0df",borderColor:"#e0bd91"},
  capabilityTitle:{fontSize:18,fontWeight:"bold"},
  capabilityStatus:{fontWeight:"bold",fontSize:16,marginTop:6,textTransform:"capitalize"},
  capabilityText:{marginTop:8,lineHeight:20},
  emptyBox:{backgroundColor:"white",padding:18,borderRadius:14,borderWidth:1,borderColor:"#ddd"},
  emptyTitle:{fontSize:18,fontWeight:"bold",marginBottom:6},
  card:{backgroundColor:"white",padding:18,borderRadius:14,borderWidth:1,borderColor:"#ddd",marginBottom:14},
  clubName:{fontSize:22,fontWeight:"bold"},
  meta:{color:"#555",marginTop:6},
  statusText:{marginTop:10,fontWeight:"600"},
  openText:{color:"#275bd6",fontWeight:"bold",marginTop:14}
});

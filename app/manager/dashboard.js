import React,{useCallback,useMemo,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import QRCodeGenerator from "../../components/QRCodeGenerator";

const ENABLED_STATUSES=["active","trial"];

function CapabilityHeader({title,status,requestStatus,onRequest}){
  const enabled=ENABLED_STATUSES.includes(status);

  return(
    <View style={styles.capabilityHeader}>
      <View style={styles.capabilityHeadingText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={[
          styles.statusPill,
          enabled ? styles.activePill : styles.inactivePill
        ]}>
          {enabled ? status : requestStatus==="pending" ? "request pending" : status || "inactive"}
        </Text>
      </View>

      {!enabled && requestStatus!=="pending" && (
        <Pressable style={styles.requestButton} onPress={onRequest}>
          <Text style={styles.requestButtonText}>Request access</Text>
        </Pressable>
      )}
    </View>
  );
}

function QRBlock({type,id,children}){
  return(
    <View style={styles.qrSection}>
      <View style={styles.qrPreview}>{children}</View>
      <Pressable
        style={styles.printQrButton}
        onPress={()=>router.push(`/manager/qr/${type}/${id}`)}
      >
        <Text style={styles.printQrText}>Open printable QR</Text>
      </Pressable>
    </View>
  );
}

export default function ManagerDashboard(){
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [user,setUser]=useState(null);
  const [capabilities,setCapabilities]=useState({
    businesses_status:"active",
    properties_status:"active",
    activity_clubs_status:"inactive",
    events_status:"inactive"
  });
  const [requests,setRequests]=useState({});
  const [businesses,setBusinesses]=useState([]);
  const [properties,setProperties]=useState([]);
  const [clubs,setClubs]=useState([]);
  const [memberships,setMemberships]=useState([]);
  const [workingId,setWorkingId]=useState(null);

  useFocusEffect(
    useCallback(()=>{
      loadDashboard();
    },[])
  );

  async function loadDashboard(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();

    if(!currentUser){
      router.replace("/auth/login");
      return;
    }

    setUser(currentUser);

    const {data:profile,error:profileError}=await supabase
      .from("profiles")
      .select("account_type")
      .eq("id",currentUser.id)
      .single();

    if(profileError || profile?.account_type!=="manager"){
      setError("A manager account is required to open this dashboard.");
      setLoading(false);
      return;
    }

    const [
      capabilityResult,
      requestResult,
      businessResult,
      propertyResult,
      clubResult
    ]=await Promise.all([
      supabase
        .from("manager_capabilities")
        .select("*")
        .eq("user_id",currentUser.id)
        .maybeSingle(),
      supabase
        .from("manager_capability_requests")
        .select("capability,status")
        .eq("user_id",currentUser.id),
      supabase
        .from("businesses")
        .select("*")
        .eq("owner_id",currentUser.id)
        .order("name",{ascending:true}),
      supabase
        .from("properties")
        .select("*")
        .eq("owner_id",currentUser.id)
        .order("created_at",{ascending:false}),
      supabase
        .from("activity_clubs")
        .select("*")
        .eq("manager_id",currentUser.id)
        .order("created_at",{ascending:false})
    ]);

    if(capabilityResult.error){
      console.log(capabilityResult.error);
      setError("Manager capabilities could not be loaded.");
      setLoading(false);
      return;
    }

    setCapabilities(capabilityResult.data || {
      businesses_status:"active",
      properties_status:"active",
      activity_clubs_status:"inactive",
      events_status:"inactive"
    });

    const requestMap={};
    (requestResult.data || []).forEach(item=>{
      requestMap[item.capability]=item.status;
    });
    setRequests(requestMap);

    setBusinesses(businessResult.data || []);
    setProperties(propertyResult.data || []);
    setClubs(clubResult.data || []);

    const clubIds=(clubResult.data || []).map(club=>club.id);

    if(clubIds.length){
      const {data:membershipRows,error:membershipError}=await supabase
        .from("activity_memberships")
        .select("*")
        .in("club_id",clubIds)
        .order("applied_at",{ascending:true});

      if(membershipError){
        console.log(membershipError);
      }

      setMemberships(membershipRows || []);
    }else{
      setMemberships([]);
    }

    setLoading(false);
  }

  const pendingByClub=useMemo(()=>{
    const grouped={};
    memberships
      .filter(item=>item.status==="pending")
      .forEach(item=>{
        if(!grouped[item.club_id]) grouped[item.club_id]=[];
        grouped[item.club_id].push(item);
      });
    return grouped;
  },[memberships]);

  function capabilityEnabled(capability){
    return ENABLED_STATUSES.includes(capabilities?.[`${capability}_status`]);
  }

  async function requestCapability(capability,label){
    if(!user) return;

    setWorkingId(`request-${capability}`);

    const now=new Date().toISOString();
    const {error:requestError}=await supabase
      .from("manager_capability_requests")
      .upsert({
        user_id:user.id,
        capability,
        status:"pending",
        request_note:`Access requested for ${label}`,
        requested_at:now,
        updated_at:now,
        decided_at:null
      },{onConflict:"user_id,capability"});

    setWorkingId(null);

    if(requestError){
      console.log(requestError);
      Alert.alert("Request not sent",requestError.message);
      return;
    }

    Alert.alert("Request sent",`${label} access has been requested.`);
    await loadDashboard();
  }

  async function decideMembership(membershipId,status){
    setWorkingId(membershipId);

    const {error:updateError}=await supabase
      .from("activity_memberships")
      .update({
        status,
        decided_at:new Date().toISOString()
      })
      .eq("id",membershipId);

    setWorkingId(null);

    if(updateError){
      console.log(updateError);
      Alert.alert("Member not updated",updateError.message);
      return;
    }

    await loadDashboard();
  }

  if(loading){
    return(
      <View style={styles.loading}>
        <ActivityIndicator size="large"/>
        <Text style={styles.loadingText}>Loading manager dashboard...</Text>
      </View>
    );
  }

  if(error){
    return(
      <View style={styles.loading}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const businessesEnabled=capabilityEnabled("businesses");
  const propertiesEnabled=capabilityEnabled("properties");
  const activitiesEnabled=capabilityEnabled("activity_clubs");
  const eventsEnabled=capabilityEnabled("events");

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Manager Dashboard</Text>
      <Text style={styles.subtitle}>
        Manage every listing, membership request and printable QR code from one place.
      </Text>

      <View style={styles.section}>
        <CapabilityHeader
          title={`🏪 Businesses (${businesses.length})`}
          status={capabilities.businesses_status}
          requestStatus={requests.businesses}
          onRequest={()=>requestCapability("businesses","Businesses")}
        />

        {businessesEnabled ? (
          <>
            {businesses.length===0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No businesses yet</Text>
                <Text style={styles.emptyText}>Create your first business listing.</Text>
              </View>
            )}

            {businesses.map(business=>(
              <View key={business.id} style={styles.card}>
                <Text style={styles.cardTitle}>{business.name}</Text>
                <Text style={styles.cardSub}>{business.category || business.address}</Text>

                <QRBlock type="business" id={business.id}>
                  <QRCodeGenerator businessId={business.id} size={120}/>
                </QRBlock>

                <View style={styles.buttonRow}>
                  <Pressable style={styles.secondaryButton} onPress={()=>router.push(`/business/edit/${business.id}`)}>
                    <Text style={styles.secondaryButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.darkButton} onPress={()=>router.push(`/business/${business.id}`)}>
                    <Text style={styles.buttonText}>Public profile</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable style={styles.addButton} onPress={()=>router.push("/business/add")}>
              <Text style={styles.buttonText}>➕ Add Business</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.lockedCard}>
            <Text>Request this capability to create and manage business listings.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <CapabilityHeader
          title={`🏠 Properties (${properties.length})`}
          status={capabilities.properties_status}
          requestStatus={requests.properties}
          onRequest={()=>requestCapability("properties","Properties")}
        />

        {propertiesEnabled ? (
          <>
            {properties.length===0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No properties yet</Text>
                <Text style={styles.emptyText}>Create your first property listing.</Text>
              </View>
            )}

            {properties.map(property=>(
              <View key={property.id} style={styles.card}>
                <Text style={styles.cardTitle}>{property.name}</Text>
                <Text style={styles.cardSub}>{property.address}</Text>

                <QRBlock type="property" id={property.id}>
                  <QRCodeGenerator propertyId={property.id} size={120}/>
                </QRBlock>

                <View style={styles.buttonRow}>
                  <Pressable style={styles.secondaryButton} onPress={()=>router.push(`/property/edit/${property.id}`)}>
                    <Text style={styles.secondaryButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.darkButton} onPress={()=>router.push(`/property/${property.id}`)}>
                    <Text style={styles.buttonText}>Public profile</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable style={styles.addButton} onPress={()=>router.push("/property/add")}>
              <Text style={styles.buttonText}>➕ Add Property</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.lockedCard}>
            <Text>Request this capability to create and manage property listings.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <CapabilityHeader
          title={`🏃 Activity Clubs (${clubs.length})`}
          status={capabilities.activity_clubs_status}
          requestStatus={requests.activity_clubs}
          onRequest={()=>requestCapability("activity_clubs","Activity Clubs")}
        />

        {activitiesEnabled ? (
          <>
            {clubs.length===0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Activity Clubs yet</Text>
                <Text style={styles.emptyText}>Create your first club listing.</Text>
              </View>
            )}

            {clubs.map(club=>{
              const pending=pendingByClub[club.id] || [];

              return(
                <View key={club.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{club.name}</Text>
                  <Text style={styles.cardSub}>{club.category} · {club.location}</Text>
                  <Text style={styles.memberCount}>
                    Pending membership requests: {pending.length}
                  </Text>

                  <QRBlock type="activity" id={club.id}>
                    <QRCodeGenerator activityClubId={club.id} size={120}/>
                  </QRBlock>

                  <View style={styles.buttonRow}>
                    <Pressable style={styles.secondaryButton} onPress={()=>router.push(`/activity-clubs/edit/${club.id}`)}>
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.darkButton} onPress={()=>router.push(`/activity-clubs/${club.id}`)}>
                      <Text style={styles.buttonText}>Public profile</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.boardButton}
                    onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}
                  >
                    <Text style={styles.buttonText}>Open private message board</Text>
                  </Pressable>

                  <Text style={styles.applicationTitle}>Membership requests</Text>

                  {pending.length===0 ? (
                    <View style={styles.noApplications}>
                      <Text>No explorers are waiting for approval.</Text>
                    </View>
                  ) : (
                    pending.map(application=>(
                      <View key={application.id} style={styles.applicationCard}>
                        <Text style={styles.applicantName}>{application.applicant_name || "Explorer"}</Text>
                        {!!application.application_note && (
                          <Text style={styles.applicationNote}>{application.application_note}</Text>
                        )}
                        <View style={styles.buttonRow}>
                          <Pressable
                            style={styles.approveButton}
                            disabled={workingId===application.id}
                            onPress={()=>decideMembership(application.id,"approved")}
                          >
                            <Text style={styles.buttonText}>Approve</Text>
                          </Pressable>
                          <Pressable
                            style={styles.rejectButton}
                            disabled={workingId===application.id}
                            onPress={()=>decideMembership(application.id,"rejected")}
                          >
                            <Text style={styles.buttonText}>Reject</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })}

            <Pressable style={styles.addButton} onPress={()=>router.push("/activity-clubs/add")}>
              <Text style={styles.buttonText}>➕ Add Activity Club</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.lockedCard}>
            <Text>Request this paid capability to create clubs and approve explorer members.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <CapabilityHeader
          title="🎉 Events"
          status={capabilities.events_status}
          requestStatus={requests.events}
          onRequest={()=>requestCapability("events","Events")}
        />

        {eventsEnabled ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Events enabled</Text>
            <Text style={styles.emptyText}>Event listing controls will appear here as the Events capability is built.</Text>
          </View>
        ) : (
          <View style={styles.lockedCard}>
            <Text>Request the Events capability to create and manage event listings.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f7fb"},
  content:{padding:20,paddingBottom:60},
  loading:{flex:1,justifyContent:"center",alignItems:"center",padding:30},
  loadingText:{marginTop:16,color:"#555"},
  errorText:{fontSize:18,textAlign:"center"},
  title:{fontSize:32,fontWeight:"bold",marginTop:10},
  subtitle:{fontSize:16,color:"#666",lineHeight:23,marginBottom:26,marginTop:6},
  section:{marginBottom:34},
  capabilityHeader:{marginBottom:14},
  capabilityHeadingText:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  sectionTitle:{fontSize:23,fontWeight:"bold",flexShrink:1},
  statusPill:{fontSize:12,fontWeight:"bold",textTransform:"capitalize",paddingHorizontal:10,paddingVertical:6,borderRadius:20,overflow:"hidden"},
  activePill:{backgroundColor:"#ddf5e5",color:"#1f7135"},
  inactivePill:{backgroundColor:"#fff0d8",color:"#82520b"},
  requestButton:{backgroundColor:"#275bd6",padding:13,borderRadius:10,marginTop:12,alignSelf:"flex-start"},
  requestButtonText:{color:"white",fontWeight:"bold"},
  card:{backgroundColor:"white",padding:18,borderRadius:14,marginBottom:15,borderWidth:1,borderColor:"#e5e5e5"},
  cardTitle:{fontSize:21,fontWeight:"bold"},
  cardSub:{fontSize:15,color:"#666",marginTop:5},
  memberCount:{fontWeight:"600",marginTop:10,color:"#5633a8"},
  qrSection:{flexDirection:"row",alignItems:"center",gap:16,marginTop:16,paddingTop:16,borderTopWidth:1,borderColor:"#eee"},
  qrPreview:{padding:8,backgroundColor:"white"},
  printQrButton:{flex:1,backgroundColor:"#eef1ff",padding:14,borderRadius:10},
  printQrText:{color:"#314eaa",fontWeight:"bold",textAlign:"center"},
  buttonRow:{flexDirection:"row",gap:10,marginTop:12},
  darkButton:{flex:1,backgroundColor:"#222",padding:14,borderRadius:10},
  secondaryButton:{flex:1,backgroundColor:"white",padding:14,borderRadius:10,borderWidth:1,borderColor:"#222"},
  secondaryButtonText:{color:"#222",fontWeight:"bold",textAlign:"center"},
  boardButton:{backgroundColor:"#5633a8",padding:14,borderRadius:10,marginTop:10},
  addButton:{backgroundColor:"#0066ff",padding:16,borderRadius:12,marginTop:8},
  buttonText:{color:"white",textAlign:"center",fontWeight:"bold"},
  emptyCard:{backgroundColor:"white",padding:20,borderRadius:14,borderWidth:1,borderColor:"#e5e5e5"},
  emptyTitle:{fontSize:18,fontWeight:"bold"},
  emptyText:{fontSize:15,color:"#666",marginTop:8,lineHeight:21},
  lockedCard:{backgroundColor:"#fff8e7",padding:18,borderRadius:14,borderWidth:1,borderColor:"#f0d78c"},
  applicationTitle:{fontSize:18,fontWeight:"bold",marginTop:22,marginBottom:10},
  noApplications:{backgroundColor:"#f5f6f8",padding:14,borderRadius:10},
  applicationCard:{backgroundColor:"#f7f8fc",padding:14,borderRadius:11,marginBottom:10},
  applicantName:{fontSize:17,fontWeight:"bold"},
  applicationNote:{color:"#555",lineHeight:20,marginTop:6},
  approveButton:{flex:1,backgroundColor:"#218739",padding:13,borderRadius:10},
  rejectButton:{flex:1,backgroundColor:"#c23b3b",padding:13,borderRadius:10}
});

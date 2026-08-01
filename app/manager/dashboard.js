import React,{useCallback,useMemo,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import QRCodeGenerator from "../../components/QRCodeGenerator";
import {useFeedback} from "../../context/FeedbackContext";

const ENABLED_STATUSES=["active","trial"];

function CapabilityHeader({title,status,requestStatus,onRequest}){
  const enabled=ENABLED_STATUSES.includes(status);
  return(
    <View style={styles.capabilityHeader}>
      <View style={styles.capabilityHeadingText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={[styles.statusPill,enabled ? styles.activePill : styles.inactivePill]}>
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
      <Pressable style={styles.printQrButton} onPress={()=>router.push(`/manager/qr/${type}/${id}`)}>
        <Text style={styles.printQrText}>Open printable QR</Text>
      </Pressable>
    </View>
  );
}

function MemberIdentity({membership,profiles}){
  const profile=profiles[membership.user_id];
  const name=profile?.full_name || membership.applicant_name || "Explorer";

  return(
    <View style={styles.memberIdentity}>
      {profile?.profile_photo ? (
        <Image source={{uri:profile.profile_photo}} style={styles.memberAvatar}/>
      ) : (
        <View style={styles.memberAvatarFallback}>
          <Text style={styles.memberInitial}>{name.slice(0,1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.memberNameWrap}>
        <Text style={styles.applicantName}>{name}</Text>
        <Text style={styles.memberAccessText}>
          {membership.status==="approved" ? "Message board access enabled" : "Waiting for approval"}
        </Text>
      </View>
    </View>
  );
}

export default function ManagerDashboard(){
  const {showFeedback}=useFeedback();
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
  const [memberProfiles,setMemberProfiles]=useState({});
  const [workingId,setWorkingId]=useState(null);

  useFocusEffect(useCallback(()=>{loadDashboard();},[]));

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

    const [capabilityResult,requestResult,businessResult,propertyResult,clubResult]=await Promise.all([
      supabase.from("manager_capabilities").select("*").eq("user_id",currentUser.id).maybeSingle(),
      supabase.from("manager_capability_requests").select("capability,status").eq("user_id",currentUser.id),
      supabase.from("businesses").select("*").eq("owner_id",currentUser.id).order("name",{ascending:true}),
      supabase.from("properties").select("*").eq("owner_id",currentUser.id).order("created_at",{ascending:false}),
      supabase.from("activity_clubs").select("*").eq("manager_id",currentUser.id).order("created_at",{ascending:false})
    ]);

    if(capabilityResult.error){
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
    (requestResult.data || []).forEach(item=>{requestMap[item.capability]=item.status;});
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
        .in("status",["pending","approved"])
        .order("applied_at",{ascending:true});

      if(membershipError) console.log(membershipError);

      const rows=membershipRows || [];
      setMemberships(rows);

      const userIds=[...new Set(rows.map(item=>item.user_id))];
      if(userIds.length){
        const {data:profileRows}=await supabase
          .from("profiles")
          .select("id,full_name,profile_photo")
          .in("id",userIds);

        const profileMap={};
        (profileRows || []).forEach(item=>{profileMap[item.id]=item;});
        setMemberProfiles(profileMap);
      }else{
        setMemberProfiles({});
      }
    }else{
      setMemberships([]);
      setMemberProfiles({});
    }

    setLoading(false);
  }

  const pendingByClub=useMemo(()=>groupMemberships(memberships,"pending"),[memberships]);
  const approvedByClub=useMemo(()=>groupMemberships(memberships,"approved"),[memberships]);

  function groupMemberships(rows,status){
    const grouped={};
    rows.filter(item=>item.status===status).forEach(item=>{
      if(!grouped[item.club_id]) grouped[item.club_id]=[];
      grouped[item.club_id].push(item);
    });
    return grouped;
  }

  function capabilityEnabled(capability){
    return ENABLED_STATUSES.includes(capabilities?.[`${capability}_status`]);
  }

  function membershipName(membershipId){
    const membership=memberships.find(item=>item.id===membershipId);
    const profile=membership ? memberProfiles[membership.user_id] : null;
    return profile?.full_name || membership?.applicant_name || "Explorer";
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
      showFeedback(requestError.message,"error","Request not sent");
      return;
    }

    showFeedback(`${label} access has been requested.`,"success","Request sent");
    await loadDashboard();
  }

  async function decideMembership(membershipId,status,club){
    const approvedCount=(approvedByClub[club.id] || []).length;

    if(status==="approved" && approvedCount>=club.member_limit){
      showFeedback(`${club.name} already has ${club.member_limit} approved members.`,"error","Member limit reached");
      return;
    }

    const name=membershipName(membershipId);
    setWorkingId(membershipId);

    const {error:updateError}=await supabase
      .from("activity_memberships")
      .update({status,decided_at:new Date().toISOString()})
      .eq("id",membershipId);

    setWorkingId(null);

    if(updateError){
      showFeedback(updateError.message,"error","Member not updated");
      return;
    }

    const messages={
      approved:`${name} was approved and now has message-board access.`,
      rejected:`${name}'s membership request was rejected.`,
      removed:`${name} was removed and their private-board access was revoked.`
    };

    showFeedback(messages[status] || `${name}'s membership was updated.`,"success","Membership updated");
    await loadDashboard();
  }

  function confirmRemoveMember(membership,club){
    const profile=memberProfiles[membership.user_id];
    const name=profile?.full_name || membership.applicant_name || "this member";

    Alert.alert(
      "Remove member?",
      `${name} will immediately lose access to ${club.name}'s private message board.`,
      [
        {text:"Cancel",style:"cancel"},
        {
          text:"Remove",
          style:"destructive",
          onPress:()=>decideMembership(membership.id,"removed",club)
        }
      ]
    );
  }

  if(loading){
    return <View style={styles.loading}><ActivityIndicator size="large"/><Text style={styles.loadingText}>Loading manager dashboard...</Text></View>;
  }

  if(error){
    return <View style={styles.loading}><Text style={styles.errorText}>{error}</Text></View>;
  }

  const businessesEnabled=capabilityEnabled("businesses");
  const propertiesEnabled=capabilityEnabled("properties");
  const activitiesEnabled=capabilityEnabled("activity_clubs");
  const eventsEnabled=capabilityEnabled("events");

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Manager Dashboard</Text>
      <Text style={styles.subtitle}>Manage listings, member requests, approved members and printable QR codes from one place.</Text>

      <View style={styles.section}>
        <CapabilityHeader title={`🏪 Businesses (${businesses.length})`} status={capabilities.businesses_status} requestStatus={requests.businesses} onRequest={()=>requestCapability("businesses","Businesses")}/>
        {businessesEnabled ? <>
          {businesses.length===0 && <EmptyCard title="No businesses yet" text="Create your first business listing."/>}
          {businesses.map(business=><View key={business.id} style={styles.card}>
            <Text style={styles.cardTitle}>{business.name}</Text>
            <Text style={styles.cardSub}>{business.category || business.address}</Text>
            <QRBlock type="business" id={business.id}><QRCodeGenerator businessId={business.id} size={120}/></QRBlock>
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={()=>router.push(`/business/edit/${business.id}`)}><Text style={styles.secondaryButtonText}>Edit</Text></Pressable>
              <Pressable style={styles.darkButton} onPress={()=>router.push(`/business/${business.id}`)}><Text style={styles.buttonText}>Public profile</Text></Pressable>
            </View>
          </View>)}
          <Pressable style={styles.addButton} onPress={()=>router.push("/business/add")}><Text style={styles.buttonText}>➕ Add Business</Text></Pressable>
        </> : <LockedCard text="Request this capability to create and manage business listings."/>}
      </View>

      <View style={styles.section}>
        <CapabilityHeader title={`🏠 Properties (${properties.length})`} status={capabilities.properties_status} requestStatus={requests.properties} onRequest={()=>requestCapability("properties","Properties")}/>
        {propertiesEnabled ? <>
          {properties.length===0 && <EmptyCard title="No properties yet" text="Create your first property listing."/>}
          {properties.map(property=><View key={property.id} style={styles.card}>
            <Text style={styles.cardTitle}>{property.name}</Text>
            <Text style={styles.cardSub}>{property.address}</Text>
            <QRBlock type="property" id={property.id}><QRCodeGenerator propertyId={property.id} size={120}/></QRBlock>
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={()=>router.push(`/property/edit/${property.id}`)}><Text style={styles.secondaryButtonText}>Edit</Text></Pressable>
              <Pressable style={styles.darkButton} onPress={()=>router.push(`/property/${property.id}`)}><Text style={styles.buttonText}>Public profile</Text></Pressable>
            </View>
          </View>)}
          <Pressable style={styles.addButton} onPress={()=>router.push("/property/add")}><Text style={styles.buttonText}>➕ Add Property</Text></Pressable>
        </> : <LockedCard text="Request this capability to create and manage property listings."/>}
      </View>

      <View style={styles.section}>
        <CapabilityHeader title={`🏃 Activity Clubs (${clubs.length})`} status={capabilities.activity_clubs_status} requestStatus={requests.activity_clubs} onRequest={()=>requestCapability("activity_clubs","Activity Clubs")}/>
        {activitiesEnabled ? <>
          {clubs.length===0 && <EmptyCard title="No Activity Clubs yet" text="Create your first club listing."/>}
          {clubs.map(club=>{
            const pending=pendingByClub[club.id] || [];
            const approved=approvedByClub[club.id] || [];
            const limit=club.member_limit || 20;
            const full=approved.length>=limit;

            return <View key={club.id} style={styles.card}>
              <Text style={styles.cardTitle}>{club.name}</Text>
              <Text style={styles.cardSub}>{club.category} · {club.location}</Text>
              <View style={styles.capacityRow}>
                <Text style={styles.memberCount}>Approved: {approved.length} / {limit}</Text>
                {full && <Text style={styles.fullPill}>FULL</Text>}
              </View>
              <Text style={styles.pendingCount}>Pending requests: {pending.length}</Text>

              <QRBlock type="activity" id={club.id}><QRCodeGenerator activityClubId={club.id} size={120}/></QRBlock>

              <View style={styles.buttonRow}>
                <Pressable style={styles.secondaryButton} onPress={()=>router.push(`/activity-clubs/edit/${club.id}`)}><Text style={styles.secondaryButtonText}>Edit</Text></Pressable>
                <Pressable style={styles.darkButton} onPress={()=>router.push(`/activity-clubs/${club.id}`)}><Text style={styles.buttonText}>Public profile</Text></Pressable>
              </View>
              <Pressable style={styles.boardButton} onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}><Text style={styles.buttonText}>Open private message board</Text></Pressable>

              <Text style={styles.applicationTitle}>Membership requests</Text>
              {pending.length===0 ? <View style={styles.noApplications}><Text>No explorers are waiting for approval.</Text></View> : pending.map(application=><View key={application.id} style={styles.applicationCard}>
                <MemberIdentity membership={application} profiles={memberProfiles}/>
                {!!application.application_note && <Text style={styles.applicationNote}>{application.application_note}</Text>}
                <View style={styles.buttonRow}>
                  <Pressable style={[styles.approveButton,full && styles.disabledButton]} disabled={workingId===application.id || full} onPress={()=>decideMembership(application.id,"approved",club)}><Text style={styles.buttonText}>{full ? "Club full" : "Approve"}</Text></Pressable>
                  <Pressable style={styles.rejectButton} disabled={workingId===application.id} onPress={()=>decideMembership(application.id,"rejected",club)}><Text style={styles.buttonText}>Reject</Text></Pressable>
                </View>
              </View>)}

              <Text style={styles.applicationTitle}>Approved members</Text>
              {approved.length===0 ? <View style={styles.noApplications}><Text>No approved members yet.</Text></View> : approved.map(member=><View key={member.id} style={styles.approvedMemberCard}>
                <MemberIdentity membership={member} profiles={memberProfiles}/>
                <Pressable style={styles.removeButton} disabled={workingId===member.id} onPress={()=>confirmRemoveMember(member,club)}><Text style={styles.removeButtonText}>Remove member</Text></Pressable>
              </View>)}
            </View>;
          })}
          <Pressable style={styles.addButton} onPress={()=>router.push("/activity-clubs/add")}><Text style={styles.buttonText}>➕ Add Activity Club</Text></Pressable>
        </> : <LockedCard text="Request this paid capability to create clubs and approve explorer members."/>}
      </View>

      <View style={styles.section}>
        <CapabilityHeader title="🎉 Events" status={capabilities.events_status} requestStatus={requests.events} onRequest={()=>requestCapability("events","Events")}/>
        {eventsEnabled ? <EmptyCard title="Events enabled" text="Event listing controls will use the same address picker and QR system when the Events capability is built."/> : <LockedCard text="Request the Events capability to create and manage event listings."/>}
      </View>
    </ScrollView>
  );
}

function EmptyCard({title,text}){
  return <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>;
}
function LockedCard({text}){
  return <View style={styles.lockedCard}><Text>{text}</Text></View>;
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f7fb"},content:{padding:20,paddingBottom:60},loading:{flex:1,justifyContent:"center",alignItems:"center",padding:30},loadingText:{marginTop:16,color:"#555"},errorText:{fontSize:18,textAlign:"center"},title:{fontSize:32,fontWeight:"bold",marginTop:10},subtitle:{fontSize:16,color:"#666",lineHeight:23,marginBottom:26,marginTop:6},section:{marginBottom:34},capabilityHeader:{marginBottom:14},capabilityHeadingText:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},sectionTitle:{fontSize:23,fontWeight:"bold",flexShrink:1},statusPill:{fontSize:12,fontWeight:"bold",textTransform:"capitalize",paddingHorizontal:10,paddingVertical:6,borderRadius:20,overflow:"hidden"},activePill:{backgroundColor:"#ddf5e5",color:"#1f7135"},inactivePill:{backgroundColor:"#fff0d8",color:"#82520b"},requestButton:{backgroundColor:"#275bd6",padding:13,borderRadius:10,marginTop:12,alignSelf:"flex-start"},requestButtonText:{color:"white",fontWeight:"bold"},card:{backgroundColor:"white",padding:18,borderRadius:14,marginBottom:15,borderWidth:1,borderColor:"#e5e5e5"},cardTitle:{fontSize:21,fontWeight:"bold"},cardSub:{fontSize:15,color:"#666",marginTop:5},capacityRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:10},memberCount:{fontWeight:"700",color:"#5633a8"},pendingCount:{color:"#555",marginTop:5},fullPill:{backgroundColor:"#ffe0e0",color:"#9d1c1c",fontSize:12,fontWeight:"bold",paddingHorizontal:9,paddingVertical:5,borderRadius:20,overflow:"hidden"},qrSection:{flexDirection:"row",alignItems:"center",gap:16,marginTop:16,paddingTop:16,borderTopWidth:1,borderColor:"#eee"},qrPreview:{padding:8,backgroundColor:"white"},printQrButton:{flex:1,backgroundColor:"#eef1ff",padding:14,borderRadius:10},printQrText:{color:"#314eaa",fontWeight:"bold",textAlign:"center"},buttonRow:{flexDirection:"row",gap:10,marginTop:12},darkButton:{flex:1,backgroundColor:"#222",padding:14,borderRadius:10},secondaryButton:{flex:1,backgroundColor:"white",padding:14,borderRadius:10,borderWidth:1,borderColor:"#222"},secondaryButtonText:{color:"#222",fontWeight:"bold",textAlign:"center"},boardButton:{backgroundColor:"#5633a8",padding:14,borderRadius:10,marginTop:10},addButton:{backgroundColor:"#0066ff",padding:16,borderRadius:12,marginTop:8},buttonText:{color:"white",textAlign:"center",fontWeight:"bold"},emptyCard:{backgroundColor:"white",padding:20,borderRadius:14,borderWidth:1,borderColor:"#e5e5e5"},emptyTitle:{fontSize:18,fontWeight:"bold"},emptyText:{fontSize:15,color:"#666",marginTop:8,lineHeight:21},lockedCard:{backgroundColor:"#fff8e7",padding:18,borderRadius:14,borderWidth:1,borderColor:"#f0d78c"},applicationTitle:{fontSize:18,fontWeight:"bold",marginTop:22,marginBottom:10},noApplications:{backgroundColor:"#f5f6f8",padding:14,borderRadius:10},applicationCard:{backgroundColor:"#f7f8fc",padding:14,borderRadius:11,marginBottom:10},approvedMemberCard:{backgroundColor:"#edf8f0",padding:14,borderRadius:11,marginBottom:10,borderWidth:1,borderColor:"#c7e5cf"},memberIdentity:{flexDirection:"row",alignItems:"center"},memberAvatar:{width:44,height:44,borderRadius:22,backgroundColor:"#ddd"},memberAvatarFallback:{width:44,height:44,borderRadius:22,backgroundColor:"#5633a8",alignItems:"center",justifyContent:"center"},memberInitial:{color:"white",fontWeight:"bold",fontSize:18},memberNameWrap:{marginLeft:11,flex:1},applicantName:{fontSize:17,fontWeight:"bold"},memberAccessText:{fontSize:12,color:"#666",marginTop:3},applicationNote:{color:"#555",lineHeight:20,marginTop:9},approveButton:{flex:1,backgroundColor:"#218739",padding:13,borderRadius:10},rejectButton:{flex:1,backgroundColor:"#c23b3b",padding:13,borderRadius:10},disabledButton:{opacity:0.55},removeButton:{borderWidth:1,borderColor:"#b42318",padding:11,borderRadius:9,marginTop:12},removeButtonText:{color:"#b42318",fontWeight:"bold",textAlign:"center"}
});

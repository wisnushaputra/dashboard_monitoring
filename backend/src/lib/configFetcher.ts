import crypto from 'crypto'

export interface ConfigFetchResult {
  content: string
  hash: string
}

export async function fetchDeviceConfig(node: {
  id: number
  name: string
  ipAddress: string
  deviceType: string
  location?: string | null
  description?: string | null
  monitorConfig?: any
}): Promise<ConfigFetchResult> {
  // If SSH configuration exists in monitorConfig, SSH logic can be called here.
  // For demo/lab devices, generate realistic Cisco/MikroTik style running-config with timestamp & hash.
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const hostName = node.name.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase()
  const devType = (node.deviceType || 'router').toLowerCase()

  let header = `! Current configuration of ${node.name} (${node.ipAddress})`
  let body = ''

  if (devType === 'router' || devType === 'firewall') {
    body = `!
version 15.6
service timestamps debug datetime msec
service timestamps log datetime msec
no service password-encryption
!
hostname ${hostName}
!
boot-start-marker
boot-end-marker
!
vrf definition MGMT
 description Management VRF
 address-family ipv4
 exit-address-family
!
enable secret 5 $1$mERr$j8b2P5/E30F.w9L6N.6S1/
!
no aaa new-model
!
ip domain name noc.internal
ip name-server 8.8.8.8 1.1.1.1
!
interface GigabitEthernet0/0
 description UPLINK-MAIN-WAN
 ip address ${node.ipAddress} 255.255.255.252
 duplex auto
 speed auto
 no shutdown
!
interface GigabitEthernet0/1
 description LOCAL-SUBNET-LAN
 ip address 172.16.${node.id % 250}.1 255.255.255.0
 duplex auto
 speed auto
 no shutdown
!
interface Loopback0
 description SYSTEM-LOOPBACK
 ip address 10.255.0.${node.id % 250} 255.255.255.255
!
router ospf 100
 router-id 10.255.0.${node.id % 250}
 network ${node.ipAddress} 0.0.0.3 area 0
 network 172.16.${node.id % 250}.0 0.0.0.255 area 0
!
snmp-server community NOC_READ_ONLY RO
snmp-server location ${node.location || 'DATACENTER-MAIN'}
snmp-server contact NOC-ENG-TEAM
!
line con 0
 exec-timeout 15 0
 logging synchronous
line vty 0 4
 exec-timeout 15 0
 login local
 transport input ssh
!
end`
  } else if (devType === 'switch' || devType === 'olt') {
    body = `!
# RouterOS / SwitchOS Config Snapshot
# Software Version: v7.14.2
# Hostname: ${hostName}
# Device IP: ${node.ipAddress}
!
/system identity set name="${hostName}"
/system logging add topics=critical,error action=remote
/port set 0 name=console
/interface bridge add name=bridge-vlan-trunk vlan-filtering=yes
/interface vlan add name=VLAN_MGMT vlan-id=10 interface=bridge-vlan-trunk
/ip address add address=${node.ipAddress}/24 interface=VLAN_MGMT comment="NOC Management IP"
/interface bridge port
add bridge=bridge-vlan-trunk interface=ether1 comment="Uplink Port"
add bridge=bridge-vlan-trunk interface=ether2 comment="Access Port Client"
add bridge=bridge-vlan-trunk interface=ether3 comment="Access Port Client"
/snmp set enabled=yes contact="NOC Team" location="${node.location || 'POP-SITE'}"
/system ntp client set enabled=yes
/system note set note="${node.description || 'Corporate Customer Switch Node'}"
end`
  } else {
    body = `! Configuration snapshot for ${devType} [${hostName}]
hostname ${hostName}
ip address ${node.ipAddress}
location ${node.location || 'NOC Site'}
snmp-community NOC_PUBLIC
end`
  }

  const fullContent = `${header}\n! Last Backup: ${dateStr}\n${body}`
  const hash = crypto.createHash('sha256').update(fullContent).digest('hex')

  return {
    content: fullContent,
    hash,
  }
}

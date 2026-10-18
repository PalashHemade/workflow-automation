# Spins up 3 disposable Ubuntu containers acting as "webservers" for the
# Ansible case study, and bootstraps sshd on each.
#
# These use geerlingguy/docker-ubuntu2204-ansible, an image built for Ansible
# Molecule testing (exec-based, no sshd preinstalled) - cgroupns_mode=host
# isn't exposed by docker-compose's schema here, so plain `docker run` is
# used instead of a compose file.

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pubKey = Join-Path $here "ssh\id_rsa.pub"

$servers = @(
    @{ Name = "devops-lab-server1"; Host = "server1"; SshPort = 2222; HttpPort = 8091 }, # 8081 was already bound on this host
    @{ Name = "devops-lab-server2"; Host = "server2"; SshPort = 2223; HttpPort = 8082 },
    @{ Name = "devops-lab-server3"; Host = "server3"; SshPort = 2224; HttpPort = 8083 }
)

foreach ($s in $servers) {
    & $docker rm -f $s.Name 2>&1 | Out-Null

    & $docker run -d --name $s.Name --hostname $s.Host --privileged --cgroupns=host `
        --tmpfs /run --tmpfs /run/lock `
        -v "/sys/fs/cgroup:/sys/fs/cgroup:rw" `
        -v "${pubKey}:/tmp/id_rsa.pub.src:ro" `
        -p "$($s.SshPort):22" -p "$($s.HttpPort):80" `
        geerlingguy/docker-ubuntu2204-ansible:latest /sbin/init
}

Start-Sleep -Seconds 5

foreach ($s in $servers) {
    Write-Host "Bootstrapping sshd on $($s.Name)..."
    # authorized_keys is copied (not bind-mounted) so it's a real file sshd's
    # StrictModes will accept - a Windows bind mount shows up world-writable,
    # which sshd silently rejects for publickey auth.
    & $docker exec $s.Name bash -c "apt-get update -qq && apt-get install -y -qq openssh-server > /dev/null 2>&1 && mkdir -p /run/sshd /root/.ssh && cp /tmp/id_rsa.pub.src /root/.ssh/authorized_keys && chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys && chown -R root:root /root/.ssh && systemctl enable --now ssh" 2>&1 | Out-Null
}

Write-Host "`n--- Status ---"
& $docker ps --filter "name=devops-lab-server"
foreach ($s in $servers) {
    $status = & $docker exec $s.Name systemctl is-active ssh
    Write-Host "$($s.Name): ssh=$status"
}

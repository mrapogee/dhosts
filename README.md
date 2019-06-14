# Dhosts

### Warning: Experimental - Under Development

Dhosts is an easy to use tool to help manage hosts + port mapping for local development on macOS. If you build on an windows or linux platform and are intrested in contributing to the project, would love to make this a cross platform tool.

```
Usage: dhosts [options] [command]

Options:
  -h, --help                     output usage information

Commands:
  init                           Setup dhosts configuration at ~/.config/dhosts
  map [options] <hostname> <ip>  Map hosts (map my.dev 127.0.0.1), or map specific ports (map my.dev:80 127.0.0.1:3000)
  activate <profile>             Activate a profile
  new [options] <profile>        Create a new profile
  list                           List all created profiles
  delete <profile>               Delete a profile
  clear                          Clear current profile & disactivate all OS mappings
  edit <profile>                 Open a profile in $EDITOR
  update                         Updates OS hosts and port settings to your current configured settings.
  edit-default                   Edit default hosts. Default hosts are always loaded, for mappings like: `localhost 127.0.0.1`
```

## Getting strated

Just call:

```
$ dhosts map <from> <to>
```

And dhosts will help you setup configuration, a profile, and activate your first mapping. See below for supported mappings.

## Mappings

Dhosts supports port forwarding (via `pfctl`) as well has editing your hosts file.

Example mappings:

```

localhost 127.0.0.1 # Just like a regular hosts entry
localhost ::1 # IPV6, of course

dev.mysite.com 127.0.0.1
dev.mysite.com:80 127.0.0.1:8080 # We also support port mappings. We'll send all local # traffic going to `dev.mysite.com:80` to `127.0.0.1:8080`

dev.mysite.com:80 :8080 # Feel free to omit the local IP address

```

> Note: I'm still understanding the capabilities of `pfctl`, so there may be more mapping features it makes sense for this tool to support. Please leave an issue if you have a use case.

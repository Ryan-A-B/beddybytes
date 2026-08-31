# HiveMQ uses Netty's portable NIO and JDK TLS paths on Android. These optional desktop-native,
# proxy, ALPN/NPN, and logging integrations are deliberately absent.
-dontwarn io.netty.channel.epoll.**
-dontwarn io.netty.handler.proxy.**
-dontwarn io.netty.internal.tcnative.**
-dontwarn org.apache.log4j.**
-dontwarn org.apache.logging.log4j.**
-dontwarn org.eclipse.jetty.alpn.**
-dontwarn org.eclipse.jetty.npn.**
-dontwarn org.slf4j.**

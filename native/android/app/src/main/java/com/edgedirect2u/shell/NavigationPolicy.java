package com.edgedirect2u.shell;
import java.net.URI;
import java.util.Set;
import java.util.Collections;
import java.util.HashSet;
import java.util.Arrays;
public final class NavigationPolicy {
    public static final String HOME="https://edgedirect2u.com";
    private static final Set<String> PAYMENTS=Collections.unmodifiableSet(new HashSet<>(Arrays.asList("checkout.paystack.com", "paystack.com")));
    private NavigationPolicy() {}
    public static boolean download(String url,String page) {
        if(!internal(url)||!internal(page))return false;
        try{return new URI(url).getHost().equalsIgnoreCase(new URI(page).getHost());}catch(Exception error){return false;}
    }
    public static boolean location(String origin,String page,boolean driver) {
        if(!driver||!internal(origin)||!internal(page))return false;
        try { URI source=new URI(origin),current=new URI(page);String path=current.getPath();return source.getHost().equalsIgnoreCase(current.getHost())&&path.startsWith("/field/")&&(source.getPath()==null||source.getPath().isEmpty()||"/".equals(source.getPath()))&&source.getQuery()==null&&source.getFragment()==null; }catch(Exception error){return false;}
    }
    public static boolean internal(String value) {
        try { URI uri=new URI(value);return "https".equalsIgnoreCase(uri.getScheme())&&("edgedirect2u.com".equalsIgnoreCase(uri.getHost())||"edgedirect2u.vercel.app".equalsIgnoreCase(uri.getHost()))&&uri.getUserInfo()==null&&(uri.getPort()==-1||uri.getPort()==443); } catch(Exception error) { return false; }
    }
    public static boolean external(String value, boolean gesture) {
        try { URI uri=new URI(value);if(uri.getUserInfo()!=null)return false;String scheme=uri.getScheme();if(gesture&&("tel".equals(scheme)||"mailto".equals(scheme)||"geo".equals(scheme)))return true;return "https".equalsIgnoreCase(scheme)&&uri.getHost()!=null&&(gesture||PAYMENTS.contains(uri.getHost().toLowerCase(java.util.Locale.ROOT))); }catch(Exception error){return false;}
    }
    public static boolean appLink(String value,String startPath) {
        if(!internal(value))return false;
        try { String path=new URI(value).getPath();return "/driver".equals(startPath)?("/driver".equals(path)||path.startsWith("/driver/")):"/checkout/confirmation".equals(path); }catch(Exception error){return false;}
    }
}

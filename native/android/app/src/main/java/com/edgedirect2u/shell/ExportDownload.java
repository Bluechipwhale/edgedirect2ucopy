package com.edgedirect2u.shell;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
final class ExportDownload {
    private ExportDownload() {}
    static void copy(String url,String page,String cookie,OutputStream output) throws IOException {
        if(!NavigationPolicy.download(url,page))throw new IOException("Untrusted export destination");
        HttpURLConnection request=(HttpURLConnection)new URL(url).openConnection();
        request.setInstanceFollowRedirects(false);request.setUseCaches(false);request.setConnectTimeout(15000);request.setReadTimeout(30000);
        request.setRequestProperty("Accept","text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        if(cookie!=null&&!cookie.isEmpty())request.setRequestProperty("Cookie",cookie);
        try {
            // Never send account cookies through a redirect, including a different trusted origin.
            if(request.getResponseCode()!=200)throw new IOException("Sign in and retry the export");
            String mime=request.getContentType();mime=mime==null?"":mime.split(";",2)[0].trim().toLowerCase(Locale.ROOT);
            if(!mime.equals("text/csv")&&!mime.equals("application/pdf")&&!mime.equals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))throw new IOException("Unsupported export response");
            if(request.getContentLengthLong()>50L*1024*1024)throw new IOException("Export exceeds 50 MB");
            try(InputStream input=request.getInputStream()){byte[] buffer=new byte[16384];long total=0;int count;while((count=input.read(buffer))!=-1){total+=count;if(total>50L*1024*1024)throw new IOException("Export exceeds 50 MB");output.write(buffer,0,count);}}
        } finally {request.disconnect();}
    }
}

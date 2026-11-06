package com.edgedirect2u.shell;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.GeolocationPermissions;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.provider.DocumentsContract;
import android.webkit.URLUtil;
import java.io.OutputStream;
public final class MainActivity extends ComponentActivity {
    private WebView browser;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private String lastInternalUrl=NavigationPolicy.HOME+BuildConfig.START_PATH;
    private ValueCallback<Uri[]> photoCallback;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private String pendingDownloadUrl;
    private boolean downloading;
    private final ActivityResultLauncher<String[]> locationPermissions=registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(),result->finishLocation(hasLocationPermission()));
    private boolean hasLocationPermission(){return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
    private void finishLocation(boolean allowed){GeolocationPermissions.Callback callback=locationCallback;String origin=locationOrigin;locationCallback=null;locationOrigin=null;if(callback!=null)callback.invoke(origin,allowed&&NavigationPolicy.location(origin,browser.getUrl(),"driver".equals(BuildConfig.FLAVOR)),false);}
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(250,250,249));
        root.setOnApplyWindowInsetsListener((view,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());view.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);root.addView(progress,new LinearLayout.LayoutParams(-1,6));
        browser=new WebView(this);browser.setId(View.generateViewId());root.addView(browser,new LinearLayout.LayoutParams(-1,0,1));
        errorPanel=new LinearLayout(this);errorPanel.setOrientation(LinearLayout.VERTICAL);errorPanel.setGravity(Gravity.CENTER);errorPanel.setPadding(32,32,32,32);errorPanel.setVisibility(View.GONE);root.addView(errorPanel,new LinearLayout.LayoutParams(-1,0,1));
        TextView title=new TextView(this);title.setText("A little pause.");title.setTextSize(30);title.setTextColor(Color.rgb(24,24,43));errorPanel.addView(title);
        TextView body=new TextView(this);body.setText("Your workspace needs a secure internet connection. Reconnect and check your latest order or delivery status before retrying an update.");body.setTextSize(16);body.setPadding(0,24,0,24);body.setGravity(Gravity.CENTER);errorPanel.addView(body);
        Button retry=new Button(this);retry.setText("Reconnect");retry.setOnClickListener(view->{showBrowser();browser.loadUrl(lastInternalUrl);});errorPanel.addView(retry);
        setContentView(root);
        WebSettings settings=browser.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setCacheMode(WebSettings.LOAD_NO_CACHE);settings.setSupportMultipleWindows(false);settings.setUserAgentString(settings.getUserAgentString()+" Edgedirect2uNative/"+BuildConfig.VERSION_NAME+"/"+BuildConfig.FLAVOR);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        settings.setGeolocationEnabled("driver".equals(BuildConfig.FLAVOR));
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(browser,false);
        browser.setWebChromeClient(new WebChromeClient(){
            @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback){
                finishLocation(false);
                if(!NavigationPolicy.location(origin,browser.getUrl(),"driver".equals(BuildConfig.FLAVOR))){callback.invoke(origin,false,false);return;}
                locationOrigin=origin;locationCallback=callback;
                if(hasLocationPermission())finishLocation(true);else locationPermissions.launch(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION});
            }
            @Override public void onGeolocationPermissionsHidePrompt(){finishLocation(false);}
            @Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);progress.setVisibility(value==100?View.GONE:View.VISIBLE);}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(!NavigationPolicy.internal(view.getUrl()))return false;if(photoCallback!=null)photoCallback.onReceiveValue(null);photoCallback=callback;Intent picker=params.createIntent();picker.addCategory(Intent.CATEGORY_OPENABLE);try{startActivityForResult(picker,100);}catch(android.content.ActivityNotFoundException error){photoCallback.onReceiveValue(null);photoCallback=null;}return true;}
        });
        browser.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){String url=request.getUrl().toString();if(NavigationPolicy.internal(url))return false;if(request.isForMainFrame()&&NavigationPolicy.external(url,request.hasGesture()))openExternal(url);return true;}
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){finishLocation(false);if(NavigationPolicy.internal(url)){lastInternalUrl=url;showBrowser();}}
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())showError();}
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame()&&response.getStatusCode()>=500)showError();}
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error){handler.cancel();showError();}
        });
        browser.setDownloadListener((url,userAgent,disposition,mime,length)->{
            if(NavigationPolicy.download(url,browser.getUrl())){
                if(downloading||pendingDownloadUrl!=null)return;
                mime=mime==null?"":mime.split(";",2)[0].trim().toLowerCase(java.util.Locale.ROOT);
                if(!"text/csv".equals(mime)&&!"application/pdf".equals(mime)&&!"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(mime)){Toast.makeText(this,"Open this download in your signed-in phone browser.",Toast.LENGTH_LONG).show();return;}
                pendingDownloadUrl=url;Intent picker=new Intent(Intent.ACTION_CREATE_DOCUMENT);picker.addCategory(Intent.CATEGORY_OPENABLE);picker.setType(mime);picker.putExtra(Intent.EXTRA_TITLE,URLUtil.guessFileName(url,disposition,mime));
                try{startActivityForResult(picker,101);}catch(android.content.ActivityNotFoundException error){pendingDownloadUrl=null;Toast.makeText(this,"No file-saving app is available on this device.",Toast.LENGTH_LONG).show();}
            }else if(NavigationPolicy.external(url,true))openExternal(url);
            else Toast.makeText(this,"Use the website in Chrome for this export.",Toast.LENGTH_LONG).show();
        });
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){back();}});
        if(state!=null)browser.restoreState(state);else{String deep=getIntent().getDataString();browser.loadUrl(NavigationPolicy.appLink(deep,BuildConfig.START_PATH)?deep:lastInternalUrl);}
    }
    private void showBrowser(){errorPanel.setVisibility(View.GONE);browser.setVisibility(View.VISIBLE);}
    private void showError(){browser.setVisibility(View.GONE);errorPanel.setVisibility(View.VISIBLE);progress.setVisibility(View.GONE);}
    private void openExternal(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(android.content.ActivityNotFoundException error){showError();}}
    private void back(){if(browser.canGoBack())browser.goBack();else finish();}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);String url=intent.getDataString();if(NavigationPolicy.appLink(url,BuildConfig.START_PATH)){showBrowser();browser.loadUrl(url);}}
    @Override protected void onSaveInstanceState(Bundle state){browser.saveState(state);super.onSaveInstanceState(state);}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==100&&photoCallback!=null){Uri[] picked=WebChromeClient.FileChooserParams.parseResult(result,data);if(picked!=null)for(Uri uri:picked)if(!"content".equals(uri.getScheme())){picked=null;break;}photoCallback.onReceiveValue(picked);photoCallback=null;}
        if(request==101){String url=pendingDownloadUrl;pendingDownloadUrl=null;Uri destination=data==null?null:data.getData();if(result!=RESULT_OK||url==null||destination==null||!"content".equals(destination.getScheme()))return;
            String page=browser.getUrl();if(!NavigationPolicy.download(url,page))return;String cookie=CookieManager.getInstance().getCookie(url);downloading=true;
            Toast.makeText(this,"Saving export…",Toast.LENGTH_SHORT).show();
            new Thread(()->{boolean saved=false;try(OutputStream output=getContentResolver().openOutputStream(destination,"w")){if(output==null)throw new java.io.IOException("File unavailable");ExportDownload.copy(url,page,cookie,output);saved=true;}catch(Exception error){try{DocumentsContract.deleteDocument(getContentResolver(),destination);}catch(Exception ignored){}}
                final boolean success=saved;runOnUiThread(()->{downloading=false;if(!isDestroyed())Toast.makeText(this,success?"Export saved":"Export could not be saved. Sign in again and retry.",Toast.LENGTH_LONG).show();});},"edge-export").start();
        }
    }
    @Override protected void onStop(){CookieManager.getInstance().flush();super.onStop();}
    @Override protected void onDestroy(){finishLocation(false);if(photoCallback!=null)photoCallback.onReceiveValue(null);browser.destroy();super.onDestroy();}
}

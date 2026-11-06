using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;
namespace Edgedirect2u.Store;
internal static class Program {
    [STAThread] private static void Main(string[] args) {
        ApplicationConfiguration.Initialize();
        Application.Run(new StoreWindow(args));
    }
}
internal sealed class StoreWindow : Form {
    private const string Home="https://edgedirect2u.com";
    private static readonly string OfflineUri="data:text/html;charset=utf-8;base64,"+Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(OfflinePage));
    private readonly WebView2 browser=new(){Dock=DockStyle.Fill};
    private readonly Label location=new(){Text="E-EDGE DIRECT 2U · YOUR EVERYDAY, WITH AN EDGE",AutoSize=true,ForeColor=Color.FromArgb(91,91,112),Margin=new Padding(18,14,0,0)};
    private readonly string[] arguments;
    private readonly bool smoke;
    public StoreWindow(string[] args) {
        arguments=args;smoke=args.Contains("--smoke-test");
        Text="E-Edge Direct 2U Store";Width=1280;Height=850;MinimumSize=new Size(450,620);StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(250,250,249);Icon=System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        var toolbar=new FlowLayoutPanel{Dock=DockStyle.Top,Height=50,Padding=new Padding(10,4,10,4),BackColor=Color.White,WrapContents=false};
        Button ToolButton(string text,Action action){var button=new Button{Text=text,AutoSize=true,FlatStyle=FlatStyle.Flat,Height=36,BackColor=Color.FromArgb(243,239,255),ForeColor=Color.FromArgb(108,59,255)};button.FlatAppearance.BorderSize=0;button.Click+=(_,_)=>action();return button;}
        toolbar.Controls.Add(ToolButton("←",()=>{if(browser.CoreWebView2?.CanGoBack==true)browser.GoBack();}));
        toolbar.Controls.Add(ToolButton("Refresh",()=>{if(browser.CoreWebView2!=null){if(InApp(browser.Source?.AbsoluteUri??""))browser.Reload();else browser.Source=new Uri(Home);}}));
        toolbar.Controls.Add(ToolButton("Store",()=>{if(browser.CoreWebView2!=null)browser.Source=new Uri(Home);}));
        toolbar.Controls.Add(ToolButton("Admin",()=>{if(browser.CoreWebView2!=null)browser.Source=new Uri(Home+"/admin");}));
        toolbar.Controls.Add(location);
        Controls.Add(browser);Controls.Add(toolbar);Shown+=async(_,_)=>await Initialize();
    }
    private static bool InApp(string value){if(!Uri.TryCreate(value,UriKind.Absolute,out var uri)||uri.Scheme!="https"||!uri.IsDefaultPort||!string.IsNullOrEmpty(uri.UserInfo))return false;return uri.Host is "edgedirect2u.vercel.app" or "edgedirect2u.com" or "checkout.paystack.com" or "paystack.com";}
    private static void External(string value){if(!Uri.TryCreate(value,UriKind.Absolute,out var uri)||!string.IsNullOrEmpty(uri.UserInfo)||uri.Scheme is not ("https" or "mailto" or "tel"))return;try{Process.Start(new ProcessStartInfo(value){UseShellExecute=true});}catch(Exception){} }
    private void SmokeLog(string message){if(!smoke)return;var index=Array.IndexOf(arguments,"--screenshot");if(index>=0&&index+1<arguments.Length)File.AppendAllText(arguments[index+1]+".log",DateTime.UtcNow.ToString("O")+" "+message+Environment.NewLine);}
    private async Task Initialize(){
        try {
            SmokeLog("Initializing secure renderer");
            string profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Edgedirect2uStore","Browser");
            var environment=await CoreWebView2Environment.CreateAsync(null,profile);
            await browser.EnsureCoreWebView2Async(environment);
            SmokeLog("Renderer ready: "+environment.BrowserVersionString);
            var settings=browser.CoreWebView2.Settings;settings.AreDevToolsEnabled=false;settings.IsWebMessageEnabled=false;settings.AreHostObjectsAllowed=false;settings.IsStatusBarEnabled=false;settings.UserAgent+=" Edgedirect2uNative/1.0.5/windows";
            browser.CoreWebView2.PermissionRequested+=(_,e)=>e.State=CoreWebView2PermissionState.Deny;
            browser.CoreWebView2.ServerCertificateErrorDetected+=(_,e)=>e.Action=CoreWebView2ServerCertificateErrorAction.Cancel;
            browser.CoreWebView2.NavigationStarting+=(_,e)=>{SmokeLog("Navigation starting "+e.NavigationId+": "+(e.Uri==OfflineUri?"bundled reconnect screen":e.Uri));if(e.Uri=="about:blank"||e.Uri==OfflineUri)return;if(!InApp(e.Uri)){e.Cancel=true;if(e.IsUserInitiated)External(e.Uri);}else location.Text=new Uri(e.Uri).Host!="checkout.paystack.com"&&new Uri(e.Uri).Host!="paystack.com"?"E-EDGE DIRECT 2U · SECURE ONLINE WORKSPACE":"PAYSTACK · SECURE CHECKOUT";};
            browser.CoreWebView2.NewWindowRequested+=(_,e)=>{e.Handled=true;if(InApp(e.Uri))browser.CoreWebView2.Navigate(e.Uri);else if(e.IsUserInitiated)External(e.Uri);};
            browser.CoreWebView2.NavigationCompleted+=async(_,e)=>{
                if(e.WebErrorStatus==CoreWebView2WebErrorStatus.OperationCanceled){SmokeLog("Superseded navigation "+e.NavigationId);return;}
                if(smoke){try{SmokeLog("Navigation: "+e.IsSuccess+" "+e.WebErrorStatus);if(!e.IsSuccess){Environment.ExitCode=1;Close();return;}var index=Array.IndexOf(arguments,"--screenshot");if(index>=0&&index+1<arguments.Length){using var stream=File.Create(arguments[index+1]);await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);SmokeLog("Captured "+stream.Length+" bytes");}Close();}catch(Exception error){SmokeLog(error.ToString());Environment.ExitCode=1;Close();}return;}
                if(!e.IsSuccess)browser.CoreWebView2.NavigateToString(OfflinePage);
            };
            if(smoke)browser.CoreWebView2.NavigateToString(OfflinePage);else browser.Source=new Uri(Home);
        }catch(Exception error){
            SmokeLog(error.ToString());
            if(smoke){Environment.ExitCode=1;Close();return;}
            MessageBox.Show("The store could not start its secure browser. Install Microsoft Edge WebView2 Runtime, then reopen Edgedirect2u.","Edgedirect2u Store",MessageBoxButtons.OK,MessageBoxIcon.Information);
            External("https://developer.microsoft.com/microsoft-edge/webview2/");Close();
        }
    }
    private const string OfflinePage="""
    <!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;color:#18182b;background:#fafaf9;margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:470px;margin:24px;padding:48px;border:1px solid #eae8f2;background:white;border-radius:24px}span{font-size:12px;font-weight:700;color:#B93400;letter-spacing:.1em}h1{font-size:42px;letter-spacing:-.06em;line-height:1.08}p{color:#6b6b80;line-height:1.7}a{display:inline-block;background:#B93400;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:600}</style><main><span>E-EDGE DIRECT 2U · A LITTLE PAUSE</span><h1>Your next good find can wait.</h1><p>Reconnect to your secure online store. Orders and account updates require an internet connection.</p><a href="https://edgedirect2u.com">Reconnect to store ↗</a></main></html>
    """;
}

using System;
using System.Collections.Generic;
using System.Text;
using System.Windows;
using System.Windows.Input;
using System.Timers;
using Microsoft.WindowsAPICodePack.Taskbar;
using System.Media;
using System.IO;

namespace WLCalendarReminder
{
    /// <summary>
    /// Interaction logic for Reminder.xaml
    /// </summary>
    public partial class Reminder : Window
    {
        public static string[] Args;

        private Timer timer;
        private readonly DateTime startDate;
        private readonly string defaultTitleText;


        public Reminder()
        {
            try
            {
                // Setting the args for debugging
                #if DEBUG
                Args = new string[] { "Test", "1261399000", "C:\\Windows\\Media\\Windows Notify.wav" };
                #endif

                // Closing the dialog if not enought arguments are provided
                if (Args.Length < 3)
                {
                    this.Close();
                    return;
                }

                InitializeComponent();

                // Setting the window position
                this.Left = System.Windows.SystemParameters.PrimaryScreenWidth - 30 - this.Width;
                this.Top = System.Windows.SystemParameters.PrimaryScreenHeight - 80 - this.Height;

                // Setting the focus to OK button to allow user to close the dialog by the enter key
                this.btnOk.Focus();

                // Playing the sound
                if (File.Exists(Args[2]))
                    (new SoundPlayer(Args[2])).Play();

                // Processing the arguments
                tbSummary.Text = Args[0];
                defaultTitleText = this.Title;
                this.Title = tbSummary.Text + " - " + defaultTitleText;

                startDate = new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc).AddSeconds(long.Parse(Args[1])).ToLocalTime();
                tbStart.Text = startDate.ToLongDateString() + " " + startDate.ToLongTimeString();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message);
                this.Close();
            }
        }


        /// <summary>
        /// Setting the "event started" state or starting the counter
        /// </summary>
        /// <param name="e"></param>
        protected override void OnContentRendered(EventArgs e)
        {
            base.OnContentRendered(e);

            if (startDate <= DateTime.Now)
                eventStarted();
            else
            {
                progressBar.Maximum = progressBar.ActualWidth;
                timer = new Timer(new TimeSpan(startDate.Ticks - DateTime.Now.Ticks).TotalMilliseconds / progressBar.Maximum);
                timer.Elapsed += delegate(object sender, ElapsedEventArgs _e) { this.Dispatcher.Invoke((ElapsedEventHandler)timer_Elapsed, sender, _e); };
                timer.Start();
            }
        }


        /// <summary>
        /// Set the event started state
        /// </summary>
        private void eventStarted()
        {
            progressBar.Value = progressBar.Maximum;
            if (TaskbarManager.IsPlatformSupported)
            {
                TaskbarManager.Instance.SetProgressValue((int)progressBar.Value, (int)progressBar.Maximum);
                TaskbarManager.Instance.SetProgressState(TaskbarProgressBarState.Paused);
            }
        }


        /// <summary>
        /// Timer elapsed handler
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void timer_Elapsed(object sender, ElapsedEventArgs e)
        {
            // Increasing the counter
            progressBar.Value++;
            if (TaskbarManager.IsPlatformSupported)
                TaskbarManager.Instance.SetProgressValue((int)progressBar.Value, (int)progressBar.Maximum);

            // Stopping the timer
            if (progressBar.Value == progressBar.Maximum)
            {
                timer.Stop();
                eventStarted();
            }
        }


        #region UI events handling

        private void dragMove(object sender, MouseButtonEventArgs e)
        {
            DragMove();
        }

        private void btnOk_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        private void btnMinimize_Click(object sender, RoutedEventArgs e)
        {
            this.WindowState = WindowState.Minimized;
        }

        #endregion
    }
}
